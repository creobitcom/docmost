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
import { Block, Page, PageContent } from '@docmost/db/types/entity.types';
import { PageService } from 'src/core/page/services/page.service';
import { BlockPermissionService } from 'src/core/page/services/block-permission.service';
import { BlockAbilityFactory } from 'src/core/casl/abilities/block-ability.factory';
import {
  BlockCaslAction,
  BlockCaslSubject,
} from 'src/core/casl/interfaces/block-ability.type';

@Injectable()
export class PersistenceExtension implements Extension {
  private readonly logger = new Logger(PersistenceExtension.name);
  private contributors: Map<string, Set<string>> = new Map();

  constructor(
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
    private readonly blockPermissionService: BlockPermissionService,
    private readonly blockAbility: BlockAbilityFactory,
    @InjectKysely() private readonly db: KyselyDB,
    private eventEmitter: EventEmitter2,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
  ) {}

  async onLoadDocument(data: onLoadDocumentPayload) {
    const { documentName, document, context, requestParameters } = data;
    const pageId = getPageId(documentName);
    const userId: string = context.user.id;

    const hasLocalContent = requestParameters.get('hasLocalContent') === 'true';
    const localContentLength = parseInt(
      requestParameters.get('localContentLength') || '0',
    );

    if (hasLocalContent && localContentLength > 0) {
      this.logger.debug(`Client has local content, skipping database load`);
      return document;
    }

    const page: Page = await this.pageRepo.findById(pageId, {
      includeContent: true,
      includeYdoc: true,
    });

    if (!page) {
      this.logger.warn('page not found');
      return;
    }

    const accessibleBlocks =
      await this.blockPermissionService.getAccessiblePageBlocks(pageId, userId);

    this.logger.debug('allowed blocks to user', accessibleBlocks);

    // if (page.ydoc) {
    //   this.logger.debug(`ydoc loaded from db: ${pageId}`);

    //   const doc = new Y.Doc();
    //   const dbState = new Uint8Array(page.ydoc);

    //   Y.applyUpdate(doc, dbState);
    //   return doc;
    // }

    if (page.content) {
      this.logger.debug(`converting json to ydoc: ${pageId}`);

      const filteredContent = this.filterContentByBlockAccess(
        userId,
        page.content,
      );

      const ydoc = TiptapTransformer.toYdoc(
        filteredContent,
        'default',
        tiptapExtensions,
      );

      Y.encodeStateAsUpdate(ydoc);
      return ydoc;
    }

    this.logger.debug(`creating fresh ydoc: ${pageId}`);
    return new Y.Doc();
  }

  async onStoreDocument(data: onStoreDocumentPayload) {
    const { documentName, document, context } = data;

    const pageId = getPageId(documentName);

    const tiptapJson = TiptapTransformer.fromYdoc(document, 'default');
    const ydocState = Buffer.from(Y.encodeStateAsUpdate(document));

    Logger.debug('Document: ', tiptapJson);

    let textContent = null;

    try {
      textContent = jsonToText(tiptapJson);
    } catch (err) {
      this.logger.warn('jsonToText' + err?.['message']);
    }

    let page: Page = null;

    try {
      await executeTx(this.db, async (trx) => {
        page = await this.pageRepo.findById(pageId, {
          withLock: true,
          includeContent: true,
          trx,
        });

        if (!page) {
          this.logger.error(`Page with id ${pageId} not found`);
          return;
        }

        if (isDeepStrictEqual(tiptapJson, page.content)) {
          page = null;
          return;
        }

        let contributorIds = undefined;
        try {
          const existingContributors = page.contributorIds || [];
          const contributorSet = this.contributors.get(documentName);
          contributorSet.add(page.creatorId);
          const newContributors = [...contributorSet];
          contributorIds = Array.from(
            new Set([...existingContributors, ...newContributors]),
          );
          this.contributors.delete(documentName);
        } catch (err) {
          this.logger.log('Contributors error:' + err?.['message']);
        }

        await this.pageService.updateForSocket(
          {
            content: tiptapJson,
            textContent: textContent,
            ydoc: ydocState,
            lastUpdatedById: context.user.id,
            contributorIds: contributorIds,
          },
          pageId,
          trx,
        );

        this.logger.debug(`Page updated: ${pageId} - SlugId: ${page.slugId}`);
      });
    } catch (err) {
      this.logger.error(`Failed to update page ${pageId}`, err);
    }

    if (page) {
      this.eventEmitter.emit('collab.page.updated', {
        page: {
          ...page,
          content: tiptapJson,
          lastUpdatedById: context.user.id,
        },
      });

      const mentions = extractMentions(tiptapJson);
      const pageMentions = extractPageMentions(mentions);

      await this.generalQueue.add(QueueJob.PAGE_BACKLINKS, {
        pageId: pageId,
        workspaceId: page.workspaceId,
        mentions: pageMentions,
      } as IPageBacklinkJob);
    }
  }

  async onChange(data: onChangePayload) {
    const documentName = data.documentName;
    const userId = data.context?.user.id;
    if (!userId) return;

    if (!this.contributors.has(documentName)) {
      this.contributors.set(documentName, new Set());
    }

    this.contributors.get(documentName).add(userId);
  }

  async afterUnloadDocument(data: afterUnloadDocumentPayload) {
    const documentName = data.documentName;
    this.contributors.delete(documentName);
  }

  private async filterContentByBlockAccess(
    userId: string,
    content: any,
  ): Promise<any> {
    for (const block of content.content) {
      const blockAbility = await this.blockAbility.createForUser(
        userId,
        block.attrs.blockId,
      );

      if (blockAbility.cannot(BlockCaslAction.Read, BlockCaslSubject.Block)) {
        if (block?.content) {
          block.content = [];
        }

        block.attrs.noAccess = true;
      } else {
        block.attrs.noAccess = true;
      }
    }
    return content;
  }

  private filterYDocByBlockAccess(doc: Y.Doc, accessibleBlocks: any[]): Y.Doc {
    const accessibleBlockIds = new Set(
      accessibleBlocks
        .filter((block) => block.hasAccess)
        .map((block) => block.id),
    );

    const fragment = doc.getXmlFragment('default');
    const filteredDoc = new Y.Doc();
    const filteredFragment = filteredDoc.getXmlFragment('default');

    filteredFragment.delete(0, filteredFragment.length);

    const processedBlockIds = new Set();

    fragment?.forEach((item) => {
      if (!item) return;

      const blockId = item.getAttribute('blockId');

      if (blockId && processedBlockIds.has(blockId)) {
        return;
      }

      const clonedItem = item.clone();
      filteredFragment.insert(filteredFragment.length, [clonedItem]);

      if (blockId) {
        processedBlockIds.add(blockId);
      }
    });

    return filteredDoc;
  }
}
