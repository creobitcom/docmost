import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('owner_id', 'uuid', (col) =>
      col.references('users.id').onDelete('no action'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('spaces').dropColumn('owner_id').execute();
}
