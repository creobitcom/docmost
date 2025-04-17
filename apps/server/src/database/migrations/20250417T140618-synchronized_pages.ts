import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  db.schema
    .createTable('syncronized_pages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('origin_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('reference_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    );
}

export async function down(db: Kysely<any>): Promise<void> {
  db.schema.dropTable('syncronized_pages');
}
