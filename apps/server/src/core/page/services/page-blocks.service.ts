import { Inject, Injectable } from '@nestjs/common';
import { DB, Json } from '../../../database/types/db';
import { extractTopLevelBlocks } from '../extract-page-blocks';
import { Kysely, sql } from 'kysely';
import { BlockDto } from '../dto/update-page-block.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Injectable()
export class PageBlocksService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async saveFromTiptapJson(pageId: string, content: Json, userId: string) {
    const blocks = extractTopLevelBlocks(content, pageId);
    return this.saveBlocksForPage(pageId, blocks, userId);
  }

  async saveBlocksForPage(pageId: string, blocks: BlockDto[], userId: string) {
    await this.db.transaction().execute(async (trx) => {
      const page = await trx
        .selectFrom('pages')
        .select(['creator_id'])
        .where('id', '=', pageId)
        .executeTakeFirst();

      if (!page) {
        throw new Error(`Page with id ${pageId} not found`);
      }

      const createdByUserId = page.creator_id || userId;
      if (!createdByUserId) {
        throw new Error('No valid user ID found for block creation. Page creator_id is null and userId is not provided.');
      }

      // Получаем все id блоков для страницы из базы
      const existingBlocks = await trx
        .selectFrom('blocks')
        .select('id')
        .where('pageId', '=', pageId)
        .execute();
      const existingIds = existingBlocks.map(b => b.id);
      const incomingIds = blocks.map(b => b.blockId).filter(Boolean);
      const toDelete = existingIds.filter(id => !incomingIds.includes(id));

      if (toDelete.length > 0) {
        // Сначала удаляем права, потом блоки
        await trx
          .deleteFrom('blockPermissions')
          .where('blockId', 'in', toDelete)
          .execute();
        await trx
          .deleteFrom('blocks')
          .where('pageId', '=', pageId)
          .where('id', 'in', toDelete)
          .execute();
      }

      const existingIdSet = new Set(existingIds);

      for (const block of blocks) {
        if (block.blockId && existingIdSet.has(block.blockId)) {
          // UPDATE
          await trx
            .updateTable('blocks')
            .set({
              content: JSON.stringify(block.content),
              blockType: block.blockType,
            })
            .where('id', '=', block.blockId)
            .where('pageId', '=', pageId)
            .execute();
        } else {
          // INSERT
          const inserted = await trx
            .insertInto('blocks')
            .values({
              id: block.blockId,
              pageId: block.pageId,
              blockType: block.blockType,
              content: JSON.stringify(block.content),
            })
            .returning('id')
            .executeTakeFirst();
          const blockId = inserted?.id;
          if (!blockId) continue;
          const hasPermissions = await trx
            .selectFrom('blockPermissions')
            .select('id')
            .where('blockId', '=', blockId)
            .limit(1)
            .executeTakeFirst();
          if (!hasPermissions) {
            await trx
              .insertInto('blockPermissions')
              .values({
                blockId,
                pageId: pageId,
                userId: createdByUserId,
                permission: 'owner',
                role: 'owner',
              })
              .onConflict((oc) =>
                oc.columns(['blockId', 'userId']).doNothing()
              )
              .execute();
          }
        }
      }
    });
  }

  async createBlock(pageId: string, dto: { pageId: string; blockType: string; position: number; content: any }, userId: string) {
    return await this.db.transaction().execute(async (trx) => {
      const page = await trx
        .selectFrom('pages')
        .select(['creator_id'])
        .where('id', '=', pageId)
        .executeTakeFirst();

      if (!page) {
        throw new Error(`Page with id ${pageId} not found`);
      }

      // Обновляем позиции существующих блоков
      await trx
        .updateTable('blocks')
        .set({ position: sql`position + 1` })
        .where('pageId', '=', pageId)
        .where('position', '>=', dto.position)
        .execute();

      // Создаем новый блок
      const inserted = await trx
        .insertInto('blocks')
        .values({
          pageId: dto.pageId,
          blockType: dto.blockType,
          position: dto.position,
          content: JSON.stringify(dto.content),
        })
        .returningAll()
        .executeTakeFirst();

      if (!inserted) {
        throw new Error('Failed to create block');
      }

      // Создаем права доступа для создателя страницы или текущего пользователя
      const blockOwnerId = page.creator_id || userId;
      if (!blockOwnerId) {
        throw new Error('No valid user ID found for block creation. Page creator_id is null and userId is not provided.');
      }

      await trx
        .insertInto('blockPermissions')
        .values({
          blockId: inserted.id,
          pageId: pageId,
          userId: blockOwnerId,
          permission: 'owner',
          role: 'owner',
        })
        .onConflict((oc) =>
          oc.columns(['blockId', 'userId']).doNothing()
        )
        .execute();

      // Парсим контент для возврата
      let parsedContent;
      try {
        parsedContent = typeof inserted.content === 'string'
          ? JSON.parse(inserted.content)
          : inserted.content;
      } catch (e) {
        console.warn('Failed to parse block content:', inserted.content);
        parsedContent = null;
      }

      return {
        id: inserted.id,
        pageId: inserted.pageId,
        blockType: inserted.blockType,
        position: inserted.position,
        content: parsedContent,
        hasAccess: true,
        userPermission: 'owner',
      };
    });
  }

  async getBlocksByPage(pageId: string) {
    return this.db
      .selectFrom('blocks')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy('position', 'asc')
      .execute();
  }

  async getBlocksByPageAndIds(pageId: string, blockIds: string[]) {
    if (blockIds.length === 0) return [];

    return this.db
      .selectFrom('blocks')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', 'in', blockIds)
      .orderBy('position', 'asc')
      .execute();
  }
}
