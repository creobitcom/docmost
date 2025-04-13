import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // await db.schema
  //   .createTable('permissions')
  //   .addColumn('id', 'uuid', (col) =>
  //     col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
  //   )
  //   .addColumn('space_id', 'uuid', (col) =>
  //     col.references('spaces.id').onDelete('cascade'),
  //   )
  //   .addColumn('page_id', 'uuid', (col) =>
  //     col.references('pages.id').onDelete('cascade'),
  //   )
  //   .addColumn('name', 'varchar', (col) => col.notNull())
  //   .addColumn('added_by_id', 'uuid', (col) => col.references('users.id'))
  //   .addColumn('created_at', 'timestamptz', (col) =>
  //     col.notNull().defaultTo(sql`now()`),
  //   )
  //   .addColumn('updated_at', 'timestamptz', (col) =>
  //     col.notNull().defaultTo(sql`now()`),
  //   )
  //   .addColumn('deleted_at', 'timestamptz', (col) => col)
  //   .addUniqueConstraint('permissions_space_id_name_unique', [
  //     'name',
  //     'space_id',
  //   ])
  //   .addUniqueConstraint('permissions_page_id_name_unique', ['name', 'page_id'])
  //   .addCheckConstraint(
  //     'allow_either_user_id_or_group_id_check',
  //     sql`(("page_id" IS NOT NULL AND "space_id" IS NULL) OR ("space_id" IS NULL AND "page_id" IS NOT NULL))`,
  //   )
  //   .execute();

  await db.schema
    .createTable('permissions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('group_id', 'uuid', (col) =>
      col.references('groups.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('added_by_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('permissions_space_id_name_unique', [
      'name',
      'space_id',
    ])
    .addCheckConstraint(
      'allow_either_user_id_or_group_id_check',
      sql`(("user_id" IS NOT NULL AND "group_id" IS NULL) OR ("user_id" IS NULL AND "group_id" IS NOT NULL))`,
    )
    .addCheckConstraint(
      'allow_either_page_id_or_space_id_check',
      sql`(("page_id" IS NOT NULL AND "space_id" IS NULL) OR ("space_id" IS NULL AND "page_id" IS NOT NULL))`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('permissions').execute();
}
