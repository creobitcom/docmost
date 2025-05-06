import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../../database/types/db';
import { extractTopLevelBlocks } from '../extract-page-blocks';
import { Kysely } from 'kysely';

@Injectable()
export class PageBlocksService {
  constructor(@Inject('KyselyInstance') private readonly db: Kysely<DB>) {}

  async saveBlocksForPage(pageId: string, content: any) {
    const blocks = extractTopLevelBlocks(content, pageId);

    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('blocks')
        .where('blocks.pageId', '=', pageId)
        .execute();

      for (let i = 0; i < blocks.length; i++) {
        await trx
          .insertInto('blocks')
          .values({
            blockType: blocks[i].blockType,
            content: blocks[i].content,
            pageId: pageId,
          })
          .execute();
      }
    });
  }
}
