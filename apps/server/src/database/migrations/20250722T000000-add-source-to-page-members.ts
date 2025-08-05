import { sql, Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Добавляем поле source с значением по умолчанию 'manual'
  await db.schema
    .alterTable('page_members')
    .addColumn('source', 'varchar(20)', (col) =>
      col.defaultTo(sql.lit('manual'))
    )
    .execute();

  // Заполняем поле source значением 'manual' для всех существующих записей
  await db
    .updateTable('page_members')
    .set({ source: 'manual' })
    .where('source', 'is', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Удаляем поле source
  await db.schema
    .alterTable('page_members')
    .dropColumn('source')
    .execute();
}