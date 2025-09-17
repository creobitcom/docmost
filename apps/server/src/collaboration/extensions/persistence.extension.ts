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

  // Функция для проверки наличия текста в параграфе
  private hasTextContent(paragraph) {
    if (!paragraph || !paragraph.content) return false;
    
    // Проверяем, есть ли текстовые узлы с содержимым
    for (const node of paragraph.content) {
      if (node.type === 'text' && node.text && node.text.trim().length > 0) {
        return true;
      }
      // Рекурсивно проверяем вложенные узлы
      if (node.content && this.hasTextContent(node)) {
        return true;
      }
    }
    return false;
  }

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
        try {
          this.logger.debug(`ydoc loaded from db: ${blockId}`);
          const doc = new Y.Doc();
          const dbState = new Uint8Array(block.yjsSnapshot);
          Y.applyUpdate(doc, dbState);
          return doc;
        } catch (error) {
          this.logger.error(`Failed to load Y.js snapshot for block ${blockId}:`, error);
          // Если не удалось загрузить snapshot, продолжаем с JSON
        }
      }

      // 2. Если нет snapshot, но есть JSON content → сконвертировать
      if (block.content) {
        try {
          this.logger.debug(`converting json to ydoc: ${blockId}`);
          this.logger.debug('Sending block: ', block);

          // Проверяем, не содержит ли контент несколько параграфов
          let contentToUse = block.content;
          if (typeof block.content === 'object' && block.content !== null && 
              'type' in block.content && block.content.type === 'doc' && 
              'content' in block.content && Array.isArray(block.content.content)) {
            const paragraphs = block.content.content.filter(node => 
              typeof node === 'object' && node !== null && 'type' in node && node.type === 'paragraph'
            );
            if (paragraphs.length > 1) {
              // Берем только первый параграф
              contentToUse = {
                type: 'doc',
                content: [paragraphs[0]]
              };
              this.logger.debug(`Multiple paragraphs detected in block ${blockId}, using only first paragraph`);
            } else if (paragraphs.length === 1) {
              // Проверяем, что параграф не пустой
              const paragraph = paragraphs[0];
              if (!this.hasTextContent(paragraph)) {
                // Если параграф пустой, не создаем контент
                this.logger.debug(`Empty paragraph detected in block ${blockId}, creating empty doc`);
                contentToUse = {
                  type: 'doc',
                  content: []
                };
              }
            }
          }

          const ydoc = TiptapTransformer.toYdoc(
            contentToUse,
            'default',
            tiptapExtensions,
          );

          // Сразу прогоняем через encode/decode чтобы привести к единому виду
          const encoded = Y.encodeStateAsUpdate(ydoc);
          const doc = new Y.Doc();
          Y.applyUpdate(doc, encoded);
          return doc;
        } catch (error) {
          this.logger.error(`Failed to convert JSON to Y.js for block ${blockId}:`, error);
          // Если не удалось конвертировать, создаем новый документ
        }
      }

      // 3. Если нет вообще ничего → новый документ
      this.logger.debug(`creating fresh ydoc: ${blockId}`);
      return new Y.Doc();
    }
  }


  async onStoreDocument(data: onStoreDocumentPayload) {
    const { documentName, document, context } = data;

    // Работает только для блоков
    if (!documentName.startsWith('block.')) return;

    const blockId = documentName.split('.')[1];

    try {
      const tiptapJson = TiptapTransformer.fromYdoc(document, 'default');
      const yjsSnapshot = Buffer.from(Y.encodeStateAsUpdate(document));

      Logger.debug('Block document: ', tiptapJson);

      // Функция для проверки наличия текста в параграфе
      const hasTextContent = (paragraph) => {
        if (!paragraph || !paragraph.content) return false;
        
        // Проверяем, есть ли текстовые узлы с содержимым
        for (const node of paragraph.content) {
          if (node.type === 'text' && node.text && node.text.trim().length > 0) {
            return true;
          }
          // Рекурсивно проверяем вложенные узлы
          if (node.content && hasTextContent(node)) {
            return true;
          }
        }
        return false;
      };

      // Проверяем, не содержит ли контент несколько параграфов
      let contentToStore = tiptapJson;
      if (tiptapJson && typeof tiptapJson === 'object' && 
          tiptapJson.type === 'doc' && Array.isArray(tiptapJson.content)) {
        const paragraphs = tiptapJson.content.filter(node => 
          typeof node === 'object' && node !== null && node.type === 'paragraph'
        );
        if (paragraphs.length > 1) {
          // Берем только первый параграф
          contentToStore = {
            ...tiptapJson,
            content: [paragraphs[0]]
          };
          this.logger.debug(`Multiple paragraphs detected in block ${blockId}, storing only first paragraph`);
        } else if (paragraphs.length === 1) {
          // Проверяем, что параграф не пустой
          const paragraph = paragraphs[0];
          if (!hasTextContent(paragraph)) {
            // Если параграф пустой, не сохраняем его
            this.logger.debug(`Empty paragraph detected in block ${blockId}, skipping save`);
            return;
          }
        }
      }

      // Проверяем валидность всех узлов в контенте
      if (contentToStore && typeof contentToStore === 'object') {
        const blockIds = new Set();
        
        const validateNode = (node) => {
          if (!node || typeof node !== 'object') return false;
          if (!node.type || typeof node.type !== 'string') {
            this.logger.warn(`Invalid node type in block ${blockId}:`, node);
            return false;
          }
          
          // Проверяем поддерживаемые типы узлов
          const supportedTypes = ['doc', 'paragraph', 'heading', 'text', 'codeBlock'];
          if (!supportedTypes.includes(node.type)) {
            this.logger.warn(`Unsupported node type in block ${blockId}: ${node.type}`);
            return false;
          }
          
          // Проверяем на дублирующиеся blockId
          if (node.attrs && node.attrs.blockId) {
            const nodeBlockId = node.attrs.blockId;
            if (typeof nodeBlockId !== 'string' || nodeBlockId.length === 0) {
              this.logger.warn(`Invalid blockId in block ${blockId}:`, node.attrs.blockId);
              return false;
            }
            if (blockIds.has(nodeBlockId)) {
              this.logger.warn(`Duplicate blockId detected in block ${blockId}: ${nodeBlockId}`);
              return false;
            }
            blockIds.add(nodeBlockId);
          }
          
          if (node.content && Array.isArray(node.content)) {
            return node.content.every(validateNode);
          }
          return true;
        };

        if (!validateNode(contentToStore)) {
          this.logger.error(`Invalid content structure in block ${blockId}, skipping save`);
          return;
        }
      }

      let textContent: string = null;

      try {
        textContent = jsonToText(contentToStore);
      } catch (err) {
        this.logger.warn('jsonToText: ' + err?.['message']);
      }

      let block: any = null;

      try {
        await executeTx(this.db, async (trx) => {
          // Загружаем блок для проверки
          block = await trx
            .selectFrom('blocks')
            .selectAll()
            .where('id', '=', blockId)
            .forUpdate()
            .executeTakeFirst();

          if (!block) {
            this.logger.error(`Block with id ${blockId} not found`);
            return;
          }

          if (isDeepStrictEqual(contentToStore, block.content)) {
            block = null;
            return;
          }

          // contributors
          let contributorIds = undefined;
          try {
            const existingContributors = block.contributorIds || [];
            const contributorSet = this.contributors.get(documentName) ?? new Set();
            contributorSet.add(block.creatorId);
            const newContributors = [...contributorSet];
            contributorIds = Array.from(
              new Set([...existingContributors, ...newContributors]),
            );
            this.contributors.delete(documentName);
          } catch (err) {
            this.logger.log('Contributors error:' + err?.['message']);
          }

          // Обновляем блок
          await trx
            .updateTable('blocks')
            .set({
              content: contentToStore,
              yjsSnapshot,
              //textContent,
              //lastUpdatedById: context.user.id,
              //contributorIds: contributorIds,
              //updatedAt: new Date(),
            })
            .where('id', '=', blockId)
            .execute();

          this.logger.debug(`Block updated: ${blockId}`);
        });
      } catch (err) {
        this.logger.error(`Failed to update block ${blockId}`, err);
      }

      if (block) {
        this.eventEmitter.emit('collab.block.updated', {
          block: {
            ...block,
            content: contentToStore,
            lastUpdatedById: context.user.id,
          },
        });

        // Mentions (по желанию, если блоки тоже могут содержать ссылки)
        // Проверяем валидность контента перед извлечением mentions
        if (contentToStore && typeof contentToStore === 'object' && contentToStore.type) {
          try {
            const mentions = extractMentions(contentToStore);
            const pageMentions = extractPageMentions(mentions);

            if (pageMentions.length > 0) {
              await this.generalQueue.add(QueueJob.BLOCK_BACKLINKS, {
                blockId,
                pageId: block.pageId,
                workspaceId: block.workspaceId,
                mentions: pageMentions,
              });
            }
          } catch (err) {
            this.logger.warn(`Failed to extract mentions from block ${blockId}:`, err);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process Y.js document for block ${blockId}:`, error);
    }
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
