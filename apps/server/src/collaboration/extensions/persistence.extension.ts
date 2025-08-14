import {
  afterUnloadDocumentPayload,
  Extension,
  onChangePayload,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server';
import * as Y from 'yjs';
import { Injectable, Logger } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { getPageId, jsonToText, tiptapExtensions } from '../collaboration.util';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { Queue } from 'bullmq';
import {
  extractMentions,
  extractPageMentions,
} from '../../common/helpers/prosemirror/utils';
import { isDeepStrictEqual } from 'node:util';
import { IPageBacklinkJob } from '../../integrations/queue/constants/queue.interface';
import { Page } from '@docmost/db/types/entity.types';
import { PageService } from 'src/core/page/services/page.service';

@Injectable()
export class PersistenceExtension implements Extension {
  private readonly logger = new Logger(PersistenceExtension.name);
  private contributors: Map<string, Set<string>> = new Map();

  constructor(
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private eventEmitter: EventEmitter2,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
  ) {}

  async onLoadDocument({ documentName }) {
    if (documentName.startsWith('block.')) {
      const blockId = documentName.split('.')[1];

      const block = await this.db
        .selectFrom('blocks')
        .select(['yjsSnapshot', 'content']) // важно выбрать content тоже
        .where('id', '=', blockId)
        .executeTakeFirst();

      if (!block) {
        this.logger.warn(`block not found: ${blockId}`);
        return new Y.Doc();
      }

      // 1. Если есть yjsSnapshot → восстановить ydoc из него
      if (block.yjsSnapshot) {
        this.logger.debug(`ydoc loaded from db: ${blockId}`);
        const doc = new Y.Doc();
        const dbState = new Uint8Array(block.yjsSnapshot);
        Y.applyUpdate(doc, dbState);
        return doc;
      }

      // 2. Если нет snapshot, но есть JSON content → сконвертировать
      if (block.content) {
        this.logger.debug(`converting json to ydoc: ${blockId}`);
        this.logger.debug('Sending block: ', block);

        const ydoc = TiptapTransformer.toYdoc(
          block.content,
          'default',
          tiptapExtensions,
        );

        // Сразу прогоняем через encode/decode чтобы привести к единому виду
        const encoded = Y.encodeStateAsUpdate(ydoc);
        const doc = new Y.Doc();
        Y.applyUpdate(doc, encoded);
        return doc;
      }

      // 3. Если нет вообще ничего → новый документ
      this.logger.debug(`creating fresh ydoc: ${blockId}`);
      return new Y.Doc();
    }
  }


  async onStoreDocument({ documentName, document }) {
    if (documentName.startsWith('block.')) {
      const blockId = documentName.split('.')[1];
      const yjsSnapshot = Buffer.from(Y.encodeStateAsUpdate(document));
      await this.db
        .updateTable('blocks')
        .set({ yjsSnapshot })
        .where('id', '=', blockId)
        .execute();
          return;
        }
    // ... (другая логика для других документов, если нужно)
  }

  async onChange(data: onChangePayload) {
    const documentName = data.documentName;
    const userId = data.context?.user?.id;
    const pageId = getPageId(documentName);
    this.logger.warn(`[DIAG][onChange] onChange called for user ${userId}, pageId=${pageId}`);
    if (!userId) return;

    // Получаем разрешённые блоки для пользователя
    let allowedBlockIds: Set<string> | null = null;
    const blockPermissionService = this.pageService['blockPermissionService'];
    if (blockPermissionService) {
      const allowedBlocks = await blockPermissionService.getAccessiblePageBlocks(pageId, userId);
      allowedBlockIds = new Set(allowedBlocks.map(b => b.id));
    }

    // Удаляем новые блоки без доступа из Y.Doc
    const doc = data.document;
    const content = doc.getXmlFragment('content');
    const children = content.toArray();
    let removedBlockIds: string[] = [];
    for (let i = children.length - 1; i >= 0; i--) {
      const node = children[i];
      if (node instanceof Y.XmlElement) {
        const blockId = node.getAttribute('blockId');
        if (blockId && allowedBlockIds && !allowedBlockIds.has(blockId)) {
          content.delete(i, 1);
          removedBlockIds.push(blockId);
          this.logger.debug(`[DIAG][onChange] REMOVED block ${blockId} for user ${userId}`);
        }
      }
    }
    this.logger.warn(`[DIAG][onChange] removedBlockIds: ${JSON.stringify(removedBlockIds)}`);
    if (removedBlockIds.length > 0) {
      this.logger.warn(`[DIAG][onChange] Blocks removed for user ${userId}: ${JSON.stringify(removedBlockIds)}`);
      this.logger.warn(`[DIAG][onChange] Emitting collab.page.forceRefresh for user ${userId}`);
      this.eventEmitter.emit('collab.page.forceRefresh', {
        pageId,
        userId,
        removedBlockIds,
      });
      if (this['gateway'] && typeof this['gateway'].sendForceRefresh === 'function') {
        this.logger.warn(`[DIAG][onChange] Calling sendForceRefresh for user ${userId}`);
        try {
          this['gateway'].sendForceRefresh(userId, pageId, removedBlockIds);
        } catch (err) {
          this.logger.error(`[DIAG][onChange] sendForceRefresh error:`, err);
        }
      } else {
        this.logger.warn(`[DIAG][onChange] Gateway not found or sendForceRefresh not a function`);
      }
    }

    // ...existing code...
    if (!this.contributors.has(documentName)) {
      this.contributors.set(documentName, new Set());
    }
    this.contributors.get(documentName).add(userId);
  }

  async afterUnloadDocument(data: afterUnloadDocumentPayload) {
    const documentName = data.documentName;
    this.contributors.delete(documentName);
  }
}
