import { Inject, Injectable } from '@nestjs/common';
import { DB, Json } from '../../../database/types/db';
import { extractTopLevelBlocks } from '../extract-page-blocks';
import { Kysely } from 'kysely';
import { BlockDto } from '../dto/update-page-block.dto';


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
        let parsedContent: any;

        if (typeof block.content === 'string') {
          try {
            parsedContent = JSON.parse(block.content);
          } catch (e) {
            console.error('Invalid JSON in block.content:', block.content);
            throw new Error(`Invalid JSON in block ${block.blockId}`);
          }
        } else {
          parsedContent = block.content;
        }

        await trx
          .insertInto('blocks')
          .values({
            page_id: block.pageId,
            parent_id: block.blockId,
            block_type: block.blockType,
            content: parsedContent,
          })
          .execute();
      }
    });
  }


}


