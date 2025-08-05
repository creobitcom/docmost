import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Удаляем поле ydoc из таблицы pages
  await db.schema
    .alterTable('pages')
    .dropColumn('ydoc')
    .execute();

  // Добавляем поле yjs_snapshot в таблицу blocks
  await db.schema
    .alterTable('blocks')
    .addColumn('yjs_snapshot', 'bytea')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Откатываем изменения: возвращаем поле ydoc в pages, удаляем yjs_snapshot из blocks

  await db.schema
    .alterTable('pages')
    .addColumn('ydoc', 'bytea')
    .execute();

  await db.schema
    .alterTable('blocks')
    .dropColumn('yjs_snapshot')
    .execute();
}