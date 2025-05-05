import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('block_permissions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('pageId', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('blockId', 'uuid', (col) =>
      col.notNull().references('page_blocks.id').onDelete('cascade'),
    )
    .addColumn('userId', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('role', 'varchar', (col) =>
      col.notNull().check(sql`role IN ('admin', 'editor', 'viewer')`),
    )
    .addColumn('permission', 'varchar', (col) =>
      col.notNull().check(sql`permission IN ('read', 'write', 'delete')`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('block_permissions').execute();
}
