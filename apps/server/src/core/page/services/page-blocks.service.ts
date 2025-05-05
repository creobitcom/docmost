import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../../database/types/db';
import { v4 as uuidv4 } from 'uuid';
import { extractTopLevelBlocks } from '../extract-page-blocks';
import { Kysely } from 'kysely';

@Injectable()
export class PageBlocksService {
  constructor(@Inject('KyselyInstance') private readonly db: Kysely<DB>) {}

  async saveBlocksForPage(pageId: string, content: any) {
    const blocks = extractTopLevelBlocks(content, pageId);

    await this.db.transaction().execute(async trx => {
      await trx.deleteFrom('pageBlocks').where('pageId', '=', pageId).execute();

      for (let i = 0; i < blocks.length; i++) {
        await trx.insertInto('pageBlocks').values({
          blockId: blocks[i].blockId,
          blockType: blocks[i].blockType,
          content: blocks[i].content,
          pageId: pageId,
        }).execute();
      }
    });
  }
}
