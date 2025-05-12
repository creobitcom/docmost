import { Logger } from '@nestjs/common';
import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  const pages = await db
    .selectFrom('pages')
    .select(['id', 'content'])
    .execute();

  for (const page of pages) {
    const content = page.content;
    if (!content) {
      continue;
    }

    const blocks = content.content;
    for (const block of blocks) {
      await db
        .insertInto('blocks')
        .values({
          page_id: page.id,
          block_type: block.type,
          content: JSON.stringify(block),
        })
        .execute();
    }
  }

  await db
    .updateTable('pages')
    .set({
      content: null,
    })
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const allBlocks = await db
    .selectFrom('blocks')
    .select(['page_id', 'content'])
    .execute();

  const blocksByPage = allBlocks.reduce((acc, block) => {
    if (!acc[block.page_id]) {
      acc[block.page_id] = [];
    }
    acc[block.page_id].push(block.content);
    return acc;
  }, {});

  for (const [pageId, pageBlocks] of Object.entries(blocksByPage)) {
    await db
      .updateTable('pages')
      .set({
        content: {
          type: 'doc',
          content: pageBlocks,
        },
      })
      .where('id', '=', pageId)
      .execute();
  }

  await db.deleteFrom('blocks').execute();
}
