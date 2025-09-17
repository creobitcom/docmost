import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';

@Injectable()
export class BlockPermissionRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async insert(blockPermission: {
    pageId: string;
    blockId: string;
    userId: string;
    role: string;
    permission: string;
  }, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);

    return db
      .insertInto('blockPermissions')
      .values(blockPermission)
      .onConflict((oc) =>
        oc.columns(['blockId', 'userId']).doUpdateSet({
          role: (eb) => eb.ref('excluded.role'),
          permission: (eb) => eb.ref('excluded.permission'),
        })
      )
      .execute();
  }

  async deleteByBlockIdAndUserId(blockId: string, userId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);

    const result = await db
      .deleteFrom('blockPermissions')
      .where('blockId', '=', blockId)
      .where('userId', '=', userId)
      .executeTakeFirst();

    return {
      success: true,
      deletedRows: Number(result.numDeletedRows),
    };
  }

  async findByBlockIdAndUserId(blockId: string, userId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('blockPermissions')
      .select('id')
      .where('blockId', '=', blockId)
      .where('userId', '=', userId)
      .executeTakeFirst();
  }

  async findPublicByBlockId(blockId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('blockPermissions')
      .select('id')
      .where('blockId', '=', blockId)
      .where('permission', '=', 'public')
      .executeTakeFirst();
  }

  async hasAnyPermissions(blockId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);

    const result = await db
      .selectFrom('blockPermissions')
      .select('id')
      .where('blockId', '=', blockId)
      .executeTakeFirst();

    return !!result;
  }

  async getBlockPermissionsWithUserInfo(blockId: string, userId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('blockPermissions as bp')
      .leftJoin('blockPermissions as bp_public', (join) =>
        join.onRef('bp.blockId', '=', 'bp_public.blockId').on('bp_public.permission', '=', 'public')
      )
      .select([
        'bp.permission as userPermission',
        'bp_public.permission as publicPermission',
        (eb) =>
          eb
            .selectFrom('blockPermissions')
            .select(eb.fn.countAll().as('count'))
            .whereRef('blockPermissions.blockId', '=', 'bp.blockId')
            .as('permissionCount'),
      ])
      .where('bp.blockId', '=', blockId)
      .where('bp.userId', '=', userId)
      .executeTakeFirst();
  }
}
