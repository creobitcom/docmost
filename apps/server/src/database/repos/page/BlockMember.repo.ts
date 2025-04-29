import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { UserBlockRole } from '../../../../../server/src/core/casl/interfaces/block-ability.type';


@Injectable()
export class BlockPermissionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  /**
   * Вернёт массив ролей (['admin','writer','reader']) пользователя для конкретного блока.
   * Если прав нет — вернёт undefined.
   */
  async getUserBlockRoles(
    userId: string,
    blockId: string,
  ): Promise<UserBlockRole[] | undefined> {
    const rows = await this.db
      .selectFrom('blockPermissions')
      .select(['role'])
      .where('userId', '=', userId)
      .where('blockId', '=', blockId)
      .execute();

    if (rows.length === 0) {
      return undefined;
    }

    // Предполагаем, что в БД в столбце role хранится строка 'admin' | 'writer' | 'reader'
    return rows.map((r) => r.role as UserBlockRole);
  }

  /**
   * Сохранить новую запись о праве на блок
   */
  async insertPermission(
    permission: {
      blockId: string;
      pageId: string;
      userId: string;
      role: UserBlockRole;
      permission: string; // или конкретный тип, если понадобится
    },
  ): Promise<void> {
    await this.db
      .insertInto('blockPermissions')
      .values({
        blockId: permission.blockId,
        pageId: permission.pageId,
        userId: permission.userId,
        role: permission.role,
        permission: permission.permission,
      })
      .execute();
  }

  /**
   * Обновить запись права (например, изменить роль или permission)
   */
  async updatePermission(
    id: string,
    updates: Partial<{
      role: UserBlockRole;
      permission: string;
    }>,
  ): Promise<void> {
    await this.db
      .updateTable('blockPermissions')
      .set(updates)
      .where('id', '=', id)
      .execute();
  }

  /**
   * Удалить право
   */
  async deletePermission(id: string): Promise<void> {
    await this.db
      .deleteFrom('blockPermissions')
      .where('id', '=', id)
      .execute();
  }
}

