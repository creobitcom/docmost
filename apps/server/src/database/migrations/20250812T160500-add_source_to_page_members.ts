import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_members')
    .addColumn('source', 'varchar(20)', (col) => col.defaultTo(sql.lit('manual')))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_members')
    .dropColumn('source')
    .execute();
}


