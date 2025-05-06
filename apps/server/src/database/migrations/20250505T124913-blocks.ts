import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('blocks')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('block_type', 'text', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('blocks_page_id_idx')
    .on('blocks')
    .column('page_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('blocks').ifExists().execute();
}
