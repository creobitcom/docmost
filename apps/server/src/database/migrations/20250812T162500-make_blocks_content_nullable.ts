import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('blocks')
    .alterColumn('content', (col) => col.dropNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // В down ставим NOT NULL обратно. Постарайтесь убедиться, что null'ов в колонке нет перед откатом.
  await db.schema
    .alterTable('blocks')
    .alterColumn('content', (col) => col.setNotNull())
    .execute();
}


