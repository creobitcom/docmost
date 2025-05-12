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

  // TODO: delete content from pages
  // await db.schema.alterTable('pages').dropColumn('content').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.deleteFrom('blocks').execute();
}
