import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Заполняем NULL значением по умолчанию
  await db
    .updateTable('blocks')
    .set({
      // минимально валидный узел tiptap для блока-параграфа
      content: sql`jsonb_build_object('type','paragraph','attrs', jsonb_build_object('textAlign','left'), 'content', '[]'::jsonb)`,
    })
    .where('content', 'is', null)
    .execute();

  // Возвращаем ограничение NOT NULL
  await db.schema
    .alterTable('blocks')
    .alterColumn('content', (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('blocks')
    .alterColumn('content', (col) => col.dropNotNull())
    .execute();
}


