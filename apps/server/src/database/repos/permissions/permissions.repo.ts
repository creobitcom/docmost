import {
  InsertablePermission,
  Permission,
  UpdatablePermission,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class PermissionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async createPermission(
    permission: InsertablePermission,
    trx?: KyselyTransaction,
  ): Promise<Permission> {
    const db = dbOrTx(this.db, trx);
    return await db
      .insertInto('permissions')
      .values(permission)
      .returningAll()
      .executeTakeFirst();
  }

  async isUserHasPermission(
    userId: string,
    permissionId: string,
  ): Promise<boolean> {
    const result = await this.db
      .selectFrom('permissions')
      .where('userId', '=', userId)
      .where('id', '=', permissionId)
      .selectAll()
      .executeTakeFirst();

    return !!result;
  }

  async updatePermission(
    id: string,
    permission: UpdatablePermission,
  ): Promise<void> {
    await this.db
      .updateTable('permissions')
      .set(permission)
      .where('id', '=', id)
      .returningAll()
      .execute();
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.deleteFrom('permissions').where('id', '=', id).execute();
  }

  async findByPageUserId(
    pageId: string,
    userId: string,
  ): Promise<Permission[]> {
    return await this.db
      .selectFrom('permissions')
      .where('pageId', '=', pageId)
      .where('userId', '=', userId)
      .selectAll()
      .execute();
  }

  async findBySpaceUserId(
    spaceId: string,
    userId: string,
  ): Promise<Permission[]> {
    return await this.db
      .selectFrom('permissions')
      .where('spaceId', '=', spaceId)
      .where('userId', '=', userId)
      .selectAll()
      .execute();
  }
  async findByPageId(pageId: string) {
    return await this.db
      .selectFrom('permissions')
      .select([
        'id',
        'userId',
        'groupId',
        'pageId',
        'spaceId',
        'action',
        'object',
      ])
      .where('pageId', '=', pageId)
      .execute();
  }

  async findBySpaceId(spaceId: string): Promise<Permission[]> {
    return await this.db
      .selectFrom('permissions')
      .where('spaceId', '=', spaceId)
      .selectAll()
      .execute();
  }

  async findById(id: string): Promise<Permission | undefined> {
    return await this.db
      .selectFrom('permissions')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }
}
