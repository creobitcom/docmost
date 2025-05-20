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
import { error } from 'node:console';

@Injectable()
export class PersistenceExtension implements Extension {
  private readonly logger = new Logger(PersistenceExtension.name);
  private contributors: Map<string, Set<string>> = new Map();

  constructor(
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private eventEmitter: EventEmitter2,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
  ) {}

  async onLoadDocument(data: onLoadDocumentPayload) {
    const { documentName } = data;
    const pageId = getPageId(documentName);

    this.logger.log(`[LOAD] Loading page: documentName=${documentName}, pageId=${pageId}`);
    console.log(`[LOAD] Document requested: ${documentName}, pageId=${pageId}`);

    if (!data.document.isEmpty('default')) {
      this.logger.log(`[LOAD] Document not empty, skip loading from DB`);
      return;
    }

    let page: Page | null = null;
    try {
      page = await this.pageRepo.findById(pageId, {
        includeContent: true,
        includeYdoc: false,
      });
    } catch (error) {
      this.logger.error(`[LOAD] DB error while fetching page ${pageId}`, error);
      return;
    }

    if (!page) {
      this.logger.warn(`[LOAD] Page not found in DB: ${pageId}`);
      return;
    }

    if (page.ydoc) {
      this.logger.log(`[LOAD] Found ydoc in DB for page ${pageId}`);
      try {
        const doc = new Y.Doc();
        Y.applyUpdate(doc, new Uint8Array(page.ydoc));
        return doc;
      } catch (error) {
        this.logger.error(`[LOAD] Failed to apply ydoc update for ${pageId}`, error);
        return;
      }
    }

    if (page.content) {
      this.logger.log(`[LOAD] No ydoc, using JSON content for page ${pageId}`);
      try {
        const ydoc = TiptapTransformer.toYdoc(page.content, 'default', tiptapExtensions);
        return ydoc;
      } catch (error) {
        this.logger.error(`[LOAD] Error transforming JSON to Ydoc for ${pageId}`, error);
        return;
      }
    }

    this.logger.log(`[LOAD] No content found, creating empty doc for page ${pageId}`);
    return new Y.Doc();
  }

  async onStoreDocument(data: onStoreDocumentPayload) {
  const { documentName, document, context } = data;
  const pageId = getPageId(documentName);

  this.logger.log(`[STORE] Saving page: documentName=${documentName}, pageId=${pageId}`);
  console.log(`[STORE] Saving document for pageId: ${pageId}`);

  const tiptapJson = TiptapTransformer.fromYdoc(document, 'default');
  const ydocState = Buffer.from(Y.encodeStateAsUpdate(document));

  // DEBUG: log tiptapJson to detect issues with empty content
  console.dir(tiptapJson, { depth: null });

  // Improved empty check
  const content = tiptapJson.content;
  const isEmpty =
    Array.isArray(content) &&
    content.length === 1 &&
    content[0].type === 'paragraph' &&
    (!content[0].content ||
      (Array.isArray(content[0].content) &&
        content[0].content.length === 1 &&
        content[0].content[0].type === 'text' &&
        content[0].content[0].text === ''));

  if (isEmpty) {
    this.logger.log(`[STORE] Document is empty, skipping save for ${pageId}`);
    return;
  }

  let textContent: string | null = null;

  try {
    textContent = jsonToText(tiptapJson);
  } catch (error) {
    this.logger.warn(`[STORE] Failed to convert to text for ${pageId}: ${(error as Error).message}`);
  }

  let page: Page | null = null;

  try {
    await executeTx(this.db, async (trx) => {
      page = await this.pageRepo.findById(pageId, {
        trx,
        includeContent: true,
        withLock: true,
      });

      if (!page) {
        this.logger.warn(`[STORE] Page not found during save: ${pageId}`);
        return;
      }

      if (isDeepStrictEqual(tiptapJson, page.content)) {
        this.logger.log(`[STORE] No changes in content, skipping DB update for ${pageId}`);
        page = null;
        return;
      }

      // Contributors
      let contributorIds: string[] | undefined;
      try {
        const existing = page.contributorIds || [];
        const newContributors = [...(this.contributors.get(documentName) || new Set()), page.creatorId];
        contributorIds = Array.from(new Set([...existing, ...newContributors]));
        this.contributors.delete(documentName);
      } catch (e) {
        this.logger.warn(`[STORE] Error collecting contributors: ${(e as Error).message}`);
      }

      // Extra guard: ensure we’re not writing an empty document
      if (!tiptapJson || !tiptapJson.content || tiptapJson.content.length === 0) {
        this.logger.warn(`[STORE] tiptapJson unexpectedly empty before update for ${pageId}`);
        return;
      }

      await this.pageRepo.updatePage(
        {
          content: tiptapJson,
          textContent,
          ydoc: ydocState,
          lastUpdatedById: context.user.id,
          contributorIds,
        },
        pageId,
        trx,
      );

      this.logger.log(`[STORE] Page saved: ${pageId} (slugId: ${page.slugId})`);
    });
  } catch (err) {
    this.logger.error(`[STORE] DB update failed for page ${pageId}`, err);
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

    try {
      await this.generalQueue.add(QueueJob.PAGE_BACKLINKS, {
        pageId,
        workspaceId: page.workspaceId,
        mentions: pageMentions,
      } as IPageBacklinkJob);

      this.logger.log(`[STORE] Backlink job queued for ${pageId}`);
    } catch (error) {
      this.logger.warn(`[STORE] Failed to queue backlink job for ${pageId}: ${(error as Error).message}`);
    }
  }
}


  async onChange(data: onChangePayload) {
    const documentName = data.documentName;
    const userId = data.context?.user?.id;
    if (!userId) return;

    if (!this.contributors.has(documentName)) {
      this.contributors.set(documentName, new Set());
    }

    this.contributors.get(documentName)!.add(userId);
  }

  async afterUnloadDocument(data: afterUnloadDocumentPayload) {
    const documentName = data.documentName;
    this.contributors.delete(documentName);
    this.logger.log(`[UNLOAD] Document unloaded: ${documentName}`);
  }
}
