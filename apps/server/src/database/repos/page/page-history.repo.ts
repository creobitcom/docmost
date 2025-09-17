import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageHistory,
  Page,
  PageHistory,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class PageHistoryRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    pageHistoryId: string,
    trx?: KyselyTransaction,
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, trx);

    return await db
      .selectFrom('pageHistory')
      .selectAll()
      .select((eb) => this.withLastUpdatedBy(eb))
      .where('id', '=', pageHistoryId)
      .executeTakeFirst();
  }

  async insertPageHistory(
    insertablePageHistory: InsertablePageHistory,
    trx?: KyselyTransaction,
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageHistory')
      .values(insertablePageHistory)
      .returningAll()
      .executeTakeFirst();
  }

  async saveHistory(page: Page, trx?: KyselyTransaction): Promise<void> {
    // Получаем блоки страницы для сохранения в истории
    const blocks = await this.db
      .selectFrom('blocks')
      .select(['content'])
      .where('pageId', '=', page.id)
      .orderBy('position', 'asc')
      .execute();

    // Создаем контент из блоков для совместимости с историей
    const processedBlocks = blocks.map(block => {
      let blockContent = block.content;
      
      // Проверяем, не содержит ли блок несколько параграфов
      if (blockContent && typeof blockContent === 'object' && blockContent !== null && 
          'type' in blockContent && blockContent.type === 'doc' && 
          'content' in blockContent && Array.isArray(blockContent.content)) {
        const paragraphs = blockContent.content.filter(node => 
          typeof node === 'object' && node !== null && 'type' in node && node.type === 'paragraph'
        );
        if (paragraphs.length > 1) {
          // Берем только первый параграф
          blockContent = {
            ...blockContent,
            content: [paragraphs[0]]
          };
        }
      }
      
      return blockContent;
    }).filter(Boolean);
    
    const content = {
      type: 'doc',
      content: processedBlocks
    };

    await this.insertPageHistory(
      {
        pageId: page.id,
        slugId: page.slugId,
        title: page.title,
        content: content, // Теперь используем контент из блоков
        icon: page.icon,
        coverPhoto: page.coverPhoto,
        lastUpdatedById: page.lastUpdatedById ?? page.creatorId,
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
      },
      trx,
    );
  }

  async findPageHistoryByPageId(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pageHistory')
      .selectAll()
      .select((eb) => this.withLastUpdatedBy(eb))
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'desc');

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async findPageLastHistory(pageId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);

    return await db
      .selectFrom('pageHistory')
      .selectAll()
      .where('pageId', '=', pageId)
      .limit(1)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst();
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageHistory.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }
}
