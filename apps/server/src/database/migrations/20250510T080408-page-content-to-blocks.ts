import { Logger } from '@nestjs/common';
import { type Kysely } from 'kysely';
import { calculateBlockHash } from '../utils';

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
          pageId: page.id,
          blockType: block.type,
          content: JSON.stringify(block),
          stateHash: calculateBlockHash(block),
        })
        .execute();
    }
  }

  await db.schema.alterTable('pages').dropColumn('content').execute();
  await db.schema.alterTable('blocks').addColumn(
    'position',
    'integer',
    (col) => col.notNull().defaultTo(0),
  ).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('pages').addColumn('content', 'jsonb').execute();

  const allBlocks = await db
    .selectFrom('blocks')
    .select(['pageId', 'content'])
    .execute();

  const blocksByPage = allBlocks.reduce((acc, block) => {
    if (!acc[block.pageId]) {
      acc[block.pageId] = [];
    }
    acc[block.pageId].push(block.content);
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
