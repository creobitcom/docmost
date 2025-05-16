import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePage,
  InsertableUserPagePreferences,
  Page,
  UpdatablePage,
  UpdatableUserPagePreferences,
  UserPagePreference,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { validate as isValidUUID } from 'uuid';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Injectable()
export class PageRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private spaceMemberRepo: SpaceMemberRepo,
  ) {}

  private baseFields: Array<keyof Page> = [
    'id',
    'slugId',
    'title',
    'icon',
    'coverPhoto',
    'position',
    'parentPageId',
    'creatorId',
    'lastUpdatedById',
    'spaceId',
    'workspaceId',
    'isLocked',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'contributorIds',
    'isSynced',
  ];

  async findById(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      includeYdoc?: boolean;
      includeSpace?: boolean;
      includeCreator?: boolean;
      includeLastUpdatedBy?: boolean;
      includeContributors?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Page> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('pages')
      .select(this.baseFields)
      .$if(opts?.includeYdoc, (qb) => qb.select('ydoc'));

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    if (opts?.includeLastUpdatedBy) {
      query = query.select((eb) => this.withLastUpdatedBy(eb));
    }

    if (opts?.includeContributors) {
      query = query.select((eb) => this.withContributors(eb));
    }

    if (opts?.includeSpace) {
      query = query.select((eb) => this.withSpace(eb));
    }

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    if (isValidUUID(pageId)) {
      query = query.where('id', '=', pageId);
    } else {
      query = query.where('slugId', '=', pageId);
    }

    const page = await query.executeTakeFirst();
    if (!opts?.includeContent) {
      return { ...page, content: [] };
    }

    // todo blocks - тут мы добавили id блока
    const pageBlocks = await db
      .selectFrom('blocks')
      .select(['content'])
      .select(['id'])
      .where('pageId', '=', page.id)
      .execute();

    if (pageBlocks.length === 0) {
      return { ...page, content: [] };
    }

    const pageContent = {
      type: 'doc',
      content: pageBlocks.map((block) => {
        // @ts-ignore
        if (block.content?.attrs) {
          // @ts-ignore
          block.content.attrs.blockId = block.id;
        }
        // @ts-ignore
        if (block.attrs) {
          // @ts-ignore
          block.attrs.blockId = block.id;
        }
        return block.content;
      }),
    };

    return { ...page, content: pageContent };
  }

  async updatePage(
    updatablePage: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    this.logger.debug('Updating page: ', updatePageData);

    const db = dbOrTx(this.db, trx);

    const pageUpdateResult = await this.updatePageMetadata(
      updatePageData,
      pageId,
      db,
    );

    if (updatePageData.content) {
      await this.updatePageBlocks(updatePageData, pageId, db);
    }

    return pageUpdateResult;
  }

  private async updatePageMetadata(
    updatePageData: UpdatablePage,
    pageId: string,
    db: any,
  ): Promise<any> {
    const pageMetadata = { ...updatePageData };
    delete pageMetadata.content;

    return db
      .updateTable('pages')
      .set({ ...pageMetadata, updatedAt: new Date() })
      .where(isValidUUID(pageId) ? 'id' : 'slugId', '=', pageId)
      .executeTakeFirst();
  }

  private async updatePageBlocks(
    updatePageData: UpdatablePage,
    pageId: string,
    db: any,
  ): Promise<void> {
    const blocks: {
      attrs: { blockId: string };
      type?: string;
      content?: any[];
    }[] = (updatePageData?.content as any)?.content;

    // Fix deleting all page content
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (
        block.type === 'paragraph' &&
        !Object.prototype.hasOwnProperty.call(block, 'content')
      ) {
        blocks.splice(i, 1);
        i--;
      }
    }

    if (!blocks || blocks.length === 0) {
      return;
    }

    const existingBlocks = await this.getExistingPageBlocks(pageId, db);
    const existingBlocksMap = new Map(
      existingBlocks.map((block) => [block.id, block]),
    );

    const incomingBlockIds = new Set(
      blocks.map((block) => block.attrs.blockId),
    );
    this.logger.debug('Incoming blocks: ', incomingBlockIds);

    await this.deleteRemovedBlocks(
      pageId,
      existingBlocks,
      incomingBlockIds,
      db,
    );

    for (const block of blocks) {
      const blockId = block.attrs.blockId;
      const existingBlock = existingBlocksMap.get(blockId);
      const calculatedHash = calculateBlockHash(block);

      if (!existingBlock) {
        await this.createBlock(block, blockId, pageId, calculatedHash, db);
      } else if (existingBlock.stateHash !== calculatedHash) {
        await this.updateExistingBlock(block, blockId, calculatedHash, db);
      }
    }
  }

  private async getExistingPageBlocks(pageId: string, db: any): Promise<any[]> {
    return db
      .selectFrom('blocks')
      .select(['id', 'stateHash'])
      .where('pageId', '=', pageIds[0])
      .execute();
  }

<<<<<<< HEAD
    const existingBlocksMap = new Map(
      existingBlocks.map((block) => [block.id, block]),
    );
    const incomingBlockIds = new Set(blocks.map((block) => block.id));

    const blocksToDelete = existingBlocks.filter(
      (existingBlock) => !incomingBlockIds.has(existingBlock.id),
    );

    if (blocksToDelete.length > 0) {
=======
  private async deleteRemovedBlocks(
    pageId: string,
    existingBlocks: any[],
    incomingBlockIds: Set<string>,
    db: any,
  ): Promise<void> {
    const removedBlocks = existingBlocks.filter(
      (existingBlock) => !incomingBlockIds.has(existingBlock.id),
    );

    if (removedBlocks.length > 0) {
      this.logger.debug('Deleting blocks: ', removedBlocks);
>>>>>>> 1f8de26 (Refactor, small fix)
      await db
        .deleteFrom('blocks')
        .where('pageId', '=', pageIds[0])
        .where(
          'id',
          'in',
          removedBlocks.map((block) => block.id),
        )
        .execute();
    }
  }

<<<<<<< HEAD
    for (const block of blocks) {
      console.log('[block]');
      console.log(JSON.stringify(block, null, 2));
      const existingBlock = existingBlocksMap.get(block.id);

      const calculatedHash = await this.calculateHash(block);

      if (!existingBlock) {
        await db
          .insertInto('blocks')
          .values({
            // id: block.id,
            id: block.attrs.blockId,
            pageId: pageIds[0],
            content: block,
            blockType: block?.type,
            createdAt: new Date(),
            updatedAt: new Date(),
            stateHash: calculatedHash,
          })
          .execute();
      } else if (existingBlock.stateHash !== calculatedHash) {
        await db
          .updateTable('blocks')
          .set({
            content: block,
            updatedAt: new Date(),
            stateHash: calculatedHash,
          })
          .where('id', '=', block.id)
          .execute();
      }
    }
    return pageUpdateResult;
=======
  private async createBlock(
    block: any,
    blockId: string,
    pageId: string,
    calculatedHash: string,
    db: any,
  ): Promise<void> {
    this.logger.debug('Inserting block: ', block);

    await db
      .insertInto('blocks')
      .values({
        id: blockId,
        pageId: pageId,
        content: block,
        blockType: block?.type,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateHash: calculatedHash,
      })
      .execute();
  }

  private async updateExistingBlock(
    block: any,
    blockId: string,
    calculatedHash: string,
    db: any,
  ): Promise<void> {
    this.logger.debug('Updating block: ', block);

    await db
      .updateTable('blocks')
      .set({
        content: block,
        updatedAt: new Date(),
        stateHash: calculatedHash,
      })
      .where('id', '=', blockId)
      .execute();
>>>>>>> 1f8de26 (Refactor, small fix)
  }

  // TODO: hash fucntion
  // TODO: move to another module
  private async calculateHash(str: string): Promise<string> {
    return 'asd';
  }

  async insertPage(
    insertablePage: InsertablePage,
    trx?: KyselyTransaction,
  ): Promise<Page> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pages')
      .values(insertablePage)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async deletePage(pageId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);

    let query = db.deleteFrom('pages');

    if (isValidUUID(pageId)) {
      query = query.where('id', '=', pageId);
    } else {
      query = query.where('slugId', '=', pageId);
    }

    await query.execute();
  }

  async getRecentPagesInSpace(spaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', '=', spaceId)
      .orderBy('updatedAt', 'desc');

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async getRecentPages(userId: string, pagination: PaginationOptions) {
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', 'in', userSpaceIds)
      .orderBy('updatedAt', 'desc');

    const hasEmptyIds = userSpaceIds.length === 0;
    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
      hasEmptyIds,
    });

    return result;
  }

  withSpace(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('spaces')
        .select(['spaces.id', 'spaces.name', 'spaces.slug'])
        .whereRef('spaces.id', '=', 'pages.spaceId'),
    ).as('space');
  }

  withCreator(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.creatorId'),
    ).as('creator');
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }

  withContributors(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', sql`ANY(${eb.ref('pages.contributorIds')})`),
    ).as('contributors');
  }

  async getPageAndDescendants(parentPageId: string) {
    return this.db
      .withRecursive('page_hierarchy', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            'slugId',
            'title',
            'icon',
            // 'content',
            'parentPageId',
            'spaceId',
            'workspaceId',
          ])
          .where('id', '=', parentPageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.slugId',
                'p.title',
                'p.icon',
                // 'p.content',
                'p.parentPageId',
                'p.spaceId',
                'p.workspaceId',
              ])
              .innerJoin('page_hierarchy as ph', 'p.parentPageId', 'ph.id'),
          ),
      )
      .selectFrom('page_hierarchy')
      .selectAll()
      .execute();
  }

  async createUserPagePreferences(
    preferences: InsertableUserPagePreferences,
  ): Promise<void> {
    await this.db
      .insertInto('userPagePreferences')
      .values({
        pageId: preferences.pageId,
        userId: preferences.userId,
        position: preferences.position,
        color: preferences.color,
      })
      .execute();
  }

  async updateUserPagePreferences(
    preferences: UpdatableUserPagePreferences,
  ): Promise<void> {
    await this.db
      .updateTable('userPagePreferences')
      .set({
        position: preferences.position,
        color: preferences.color,
      })
      .where('userId', '=', preferences.userId)
      .where('pageId', '=', preferences.pageId)
      .execute();
  }

  async findUserPagePreferences(
    pageId: string,
    userId: string,
  ): Promise<UserPagePreference> {
    return await this.db
      .selectFrom('userPagePreferences')
      .selectAll()
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }
}
