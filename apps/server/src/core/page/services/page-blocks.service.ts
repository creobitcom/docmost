import { Inject, Injectable } from '@nestjs/common';
import { DB, Json } from '../../../database/types/db';
import { extractTopLevelBlocks } from '../extract-page-blocks';
import { Kysely, sql } from 'kysely';
import { BlockDto } from '../dto/update-page-block.dto';

@Injectable()
export class PageBlocksService {
  constructor(@Inject('KyselyInstance') private readonly db: Kysely<DB>) {}

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

      const createdByUserId = page.creator_id;

      await trx.deleteFrom('blocks').where('pageId', '=', pageId).execute();

      for (const block of blocks) {
        const inserted = await trx
          .insertInto('blocks')
          .values({
            pageId: block.pageId,
            blockType: block.blockType,
            content: block.content,
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
              userId: createdByUserId,
              permission: 'owner',
            })
            .onConflict((oc) =>
              oc.columns(['blockId', 'userId']).doNothing()
            )
            .execute();
        }
      }
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
