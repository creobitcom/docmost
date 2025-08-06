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
        .select(['creatorId'])
        .where('id', '=', pageId)
        .executeTakeFirst();

      if (!page) {
        throw new Error(`Page with id ${pageId} not found`);
      }

      const createdByUserId = page.creatorId || userId;
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

      // Логируем для диагностики проблемы дублирования
      console.log(`[PageBlocksService] Existing blocks for page ${pageId}:`, existingIds);

      console.log(`[PageBlocksService] Incoming blocks for page ${pageId}:`, incomingIds);


      const toDelete = existingIds.filter(id => !incomingIds.includes(id));

      if (toDelete.length > 0) {
        // Сначала удаляем права, потом блоки
        await trx
          .deleteFrom('block_permissions')
          .where('blockId', 'in', toDelete)
          .execute();
        await trx
          .deleteFrom('blocks')
          .where('pageId', '=', pageId)
          .where('id', 'in', toDelete)
          .execute();
      }

      const existingIdSet = new Set(existingIds);

      // Проверяем уникальность blockId
      const uniqueBlockIds = new Set();
      const uniqueBlocks = [];

      for (const block of blocks) {
        if (!block.blockId) {
          console.warn(`[PageBlocksService] Block without blockId found for page ${pageId}, skipping`);
          continue;
        }

        if (uniqueBlockIds.has(block.blockId)) {
          console.warn(`[PageBlocksService] Duplicate blockId found: ${block.blockId}, skipping duplicate`);
          continue;
        }

        uniqueBlockIds.add(block.blockId);
        uniqueBlocks.push(block);
      }

      console.log(`[PageBlocksService] Processing ${uniqueBlocks.length} unique blocks out of ${blocks.length} total blocks`);

      // Сортируем блоки по позиции, чтобы обеспечить правильный порядок
      const sortedBlocks = [...uniqueBlocks].sort((a, b) => {
        // Используем position из блока, а не из атрибутов контента
        const posA = a.position || 0;
        const posB = b.position || 0;
        return posA - posB;
      });

      console.log(`[PageBlocksService] Sorted blocks by position:`, sortedBlocks.map(b => ({ id: b.blockId, position: b.position })));

      for (const block of sortedBlocks) {
        // Проверяем наличие blockId
        if (!block.blockId) {
          console.warn(`[PageBlocksService] Block without blockId found for page ${pageId}`);
          continue;
        }

                // Радикально нормализуем содержимое блока, чтобы гарантировать один параграф
        const content = block.content as any;

        // Извлекаем текстовый контент из любого источника
        let textContent = [];
        let textValue = '';

        // Функция для извлечения текста из любого узла или массива узлов
        const extractText = (node) => {
          if (!node) return '';

          if (typeof node === 'string') return node;

          if (node.text) return node.text;

          if (node.content) {
            if (Array.isArray(node.content)) {
              return node.content.map(extractText).join('');
            }
            return extractText(node.content);
          }

          return '';
        };

        // Извлекаем текст из различных форматов контента
        if (content) {
          if (content.type === 'doc' && Array.isArray(content.content)) {
            textValue = extractText(content);
          } else if (content.type === 'paragraph') {
            textValue = extractText(content);
          } else if (typeof content === 'string') {
            try {
              const parsed = JSON.parse(content);
              textValue = extractText(parsed);
            } catch (e) {
              textValue = content;
            }
          }
        }

        // Если есть текст, создаем текстовый узел
        if (textValue) {
          textContent = [{ type: 'text', text: textValue }];
        }

        // Создаем новый документ с одним параграфом
        block.content = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                blockId: block.blockId,
                position: block.position || 0
              },
              content: textValue ? [{ type: 'text', text: textValue }] : []
            }
          ]
        };

        console.log(`[PageBlocksService] Normalized content for block ${block.blockId} with text: ${textValue.substring(0, 30)}${textValue.length > 30 ? '...' : ''}`);

        // Дополнительная проверка - если в контенте все еще несколько параграфов, оставляем только первый
        if (block.content.content && block.content.content.length > 1) {
          console.warn(`[PageBlocksService] Multiple paragraphs detected in block ${block.blockId}, fixing...`);

          const firstParagraph = block.content.content[0];
          const firstParagraphText = extractText(firstParagraph);

          block.content = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                attrs: {
                  textAlign: 'left',
                  blockId: block.blockId,
                  position: block.position || 0
                },
                content: firstParagraphText ? [{ type: 'text', text: firstParagraphText }] : []
              }
            ]
          };

          console.log(`[PageBlocksService] Fixed multiple paragraphs for block ${block.blockId}`);
        }


        if (existingIdSet.has(block.blockId)) {
          // UPDATE
          console.log(`[PageBlocksService] Updating block ${block.blockId} for page ${pageId}`);
          await trx
            .updateTable('blocks')
            .set({
              content: JSON.stringify(block.content),
              blockType: block.blockType,
              position: block.position || 0, // Используем position из блока
            })
            .where('id', '=', block.blockId)
            .where('pageId', '=', pageId)
            .execute();
        } else {
          // INSERT
          console.log(`[PageBlocksService] Inserting new block ${block.blockId} for page ${pageId}`);
          const inserted = await trx
            .insertInto('blocks')
            .values({
              id: block.blockId,
              pageId: block.pageId || pageId, // Используем pageId из параметра, если нет в блоке
              blockType: block.blockType,
              content: JSON.stringify(block.content),
              position: block.position || 0, // Используем position из блока
            })
            .returning('id')
            .executeTakeFirst();
          const blockId = inserted?.id;
          if (!blockId) continue;
          const hasPermissions = await trx
            .selectFrom('block_permissions')
            .select('id')
            .where('blockId', '=', blockId)
            .limit(1)
            .executeTakeFirst();
          if (!hasPermissions) {
            await trx
              .insertInto('block_permissions')
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
        .select(['creatorId'])
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
      const blockOwnerId = page.creatorId || userId;
      if (!blockOwnerId) {
        throw new Error('No valid user ID found for block creation. Page creator_id is null and userId is not provided.');
      }

      await trx
        .insertInto('block_permissions')
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

  // Получает все блоки страницы
  async getPageBlocks(pageId: string) {
    return this.db
      .selectFrom('blocks')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy('position', 'asc')
      .execute();
  }

  // Получает доступные блоки для пользователя
  async getAccessiblePageBlocks(pageId: string, userId: string) {
    // Получаем все блоки страницы
    const allBlocks = await this.getPageBlocks(pageId);
    
    // Проверяем, является ли пользователь создателем страницы
    const page = await this.db
      .selectFrom('pages')
      .select(['creatorId'])
      .where('id', '=', pageId)
      .executeTakeFirst();

    const isPageCreator = page?.creatorId === userId;
    
    // Если пользователь является создателем страницы, возвращаем все блоки
    if (isPageCreator) {
      return allBlocks;
    }
    
    // Получаем права доступа пользователя
    const permissions = await this.db
      .selectFrom('block_permissions')
      .select(['blockId', 'role'])
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .execute();

    const permissionMap = new Map(permissions.map(p => [p.blockId, p.role]));
    
    // Фильтруем блоки по правам доступа
    return allBlocks.filter(block => {
      const role = permissionMap.get(block.id);
      return role === 'owner' || role === 'edit' || role === 'read';
    });
  }

  // Обновляет блок
  async updateBlock(blockId: string, updateData: { content?: any; position?: number }) {
    const updateValues: any = {};
    
    if (updateData.content !== undefined) {
      updateValues.content = JSON.stringify(updateData.content);
    }
    if (updateData.position !== undefined) {
      updateValues.position = updateData.position;
    }

    const updated = await this.db
      .updateTable('blocks')
      .set(updateValues)
      .where('id', '=', blockId)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new Error(`Block with id ${blockId} not found`);
    }

    // Парсим контент для возврата
    let parsedContent;
    try {
      parsedContent = typeof updated.content === 'string'
        ? JSON.parse(updated.content)
        : updated.content;
    } catch (e) {
      console.warn('Failed to parse block content:', updated.content);
      parsedContent = null;
    }

    return {
      ...updated,
      content: parsedContent
    };
  }
}