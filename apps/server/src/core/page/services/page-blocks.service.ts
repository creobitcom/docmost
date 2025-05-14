import { Inject, Injectable } from '@nestjs/common';
import { DB, Json } from '../../../database/types/db';
import { extractTopLevelBlocks } from '../extract-page-blocks';
import { Kysely } from 'kysely';
import { BlockDto } from '../dto/update-page-block.dto';
import { sql } from 'kysely';

@Injectable()
export class PageBlocksService {
  constructor(@Inject('KyselyInstance') private readonly db: Kysely<DB>) {}
  async saveFromTiptapJson(pageId: string, content: Json) {
    const blocks = extractTopLevelBlocks(content, pageId);
    return this.saveBlocksForPage(pageId, blocks);
  }

  async saveBlocksForPage(pageId: string, blocks: BlockDto[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('blocks')
        .where('blocks.page_id', '=', pageId)
        .execute();

      for (const block of blocks) {
        await trx
          .insertInto('blocks')
          .values({
            page_id: block.pageId,
            block_id: block.blockId,
            block_type: block.blockType,
            content: sql`cast(${JSON.stringify(block.content)} as jsonb)`,
          })
          .execute();
      }
    });
  }

}


