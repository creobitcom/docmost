import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { UserBlockRole } from '../../../core/casl/interfaces/block-ability.type';


@Injectable()
export class BlockPermissionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}


  async getUserBlockRoles(
    userId: string,
    blockId: string,
  ): Promise<UserBlockRole[] | undefined> {
    const rows = await this.db
              .selectFrom('block_permissions')
      .select(['role'])
      .where('userId', '=', userId)
      .where('blockId', '=', blockId)
      .execute();

    if (rows.length === 0) {
      return undefined;
    }

    return rows.map((r) => r.role as UserBlockRole);
  }


  async insertPermission(
    permission: {
      blockId: string;
      pageId: string;
      userId: string;
      role: UserBlockRole;
      permission: string;
    },
  ): Promise<void> {
    await this.db
              .insertInto('block_permissions')
      .values({
        blockId: permission.blockId,
        pageId: permission.pageId,
        userId: permission.userId,
        role: permission.role,
        permission: permission.permission,
      })
      .execute();
  }


  async updatePermission(
    id: string,
    updates: Partial<{
      role: UserBlockRole;
      permission: string;
    }>,
  ): Promise<void> {
    await this.db
              .updateTable('block_permissions')
      .set(updates)
      .where('id', '=', id)
      .execute();
  }


  async deletePermission(id: string): Promise<void> {
    await this.db
              .deleteFrom('block_permissions')
      .where('id', '=', id)
      .execute();
  }
}