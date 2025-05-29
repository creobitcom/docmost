import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  Block,
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
import { ExpressionBuilder, sql, UpdateResult } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Injectable()
export class PageRepo {
  private readonly logger: Logger;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private spaceMemberRepo: SpaceMemberRepo,
  ) {
    this.logger = new Logger('PageRepo');
  }

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
      return {
        ...page,
        content: null,
      };
    }

    const pageBlocks = await this.findPageBlocks(page.id);
    if (pageBlocks.length === 0) {
      return { ...page, content: null };
    }

    const pageContent = {
      type: 'doc',
      content: pageBlocks.map((block) => {
        // @ts-ignore
        if (!block.content?.attrs) {
          // @ts-ignore
          block.content.attrs = {};
        }
        // @ts-ignore
        block.content.attrs.blockId = block.id;
        return block.content;
      }),
    };

    return { ...page, content: pageContent };
  }

  async findPageBlocks(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<Partial<Block>[]> {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('blocks')
      .select(['id', 'content'])
      .where('pageId', '=', pageId)
      .execute();
  }

  async updatePageMetadata(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<UpdateResult> {
    const db = dbOrTx(this.db, trx);
    const pageMetadata = { ...updatePageData };
    delete pageMetadata.content;

    return db
      .updateTable('pages')
      .set({ ...pageMetadata, updatedAt: new Date() })
      .where(isValidUUID(pageId) ? 'id' : 'slugId', '=', pageId)
      .executeTakeFirst();
  }

  async getExistingPageBlocks(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<any[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('blocks')
      .select(['id', 'stateHash'])
      .where('pageId', '=', pageId)
      .orderBy('position', 'asc')
      .execute();
  }

  async createBlock(
    block: any,
    blockId: string,
    pageId: string,
    calculatedHash: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    this.logger.debug('Inserting block: ', block);

    await db
      .insertInto('blocks')
      .values({
        id: blockId,
        pageId: pageId,
        position: block?.attrs.position,
        content: block,
        blockType: block?.type,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateHash: calculatedHash,
      })
      .execute();
  }

  async updateExistingBlock(
    block: any,
    blockId: string,
    calculatedHash: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    this.logger.debug('Updating block: ', block);

    await db
      .updateTable('blocks')
      .set({
        position: block?.attrs.position,
        content: block,
        updatedAt: new Date(),
        stateHash: calculatedHash,
      })
      .where('id', '=', blockId)
      .execute();
  }

  async deleteBlock(blockId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('blocks').where('id', '=', blockId).execute();
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
      .values(preferences)
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
