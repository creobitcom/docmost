import { sql, Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('shadow_pages')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('block_id', 'uuid', col => col.references('blocks.id').onDelete('cascade').notNull())
    .addColumn('page_id', 'uuid', col => col.references('pages.id').onDelete('cascade').notNull())
    .addColumn('created_by', 'uuid', col => col.references('users.id').onDelete('cascade').notNull())
    .addColumn('expires_at', 'timestamptz')           // optional
    .addColumn('created_at', 'timestamptz', col => col.defaultTo(sql`now()`))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('shadow_pages').execute()
}
