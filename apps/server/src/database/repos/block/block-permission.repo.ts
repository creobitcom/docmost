import { PageMember } from '@docmost/db/types/entity.types';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { UserBlockRole } from 'src/core/casl/interfaces/block-ability.type';
import { SaveBlockPermissionDto } from 'src/core/page/dto/save-block-permission.dto';

@Injectable()
export class BlockPermissionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async getUserBlockRoles(
    userId: string,
    blockId: string,
  ): Promise<string | null> {
    const result = await this.db
      .selectFrom('blockPermissions')
      .select(['role'])
      .where('userId', '=', userId)
      .where('blockId', '=', blockId)
      .executeTakeFirst();

    return result?.role || null;
  }

  async insertPermission(permission: {
    blockId: string;
    pageId: string;
    userId: string;
    role: UserBlockRole;
    permission: string;
  }): Promise<void> {
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

  async deletePermission(id: string): Promise<void> {
    await this.db.deleteFrom('blockPermissions').where('id', '=', id).execute();
  }

  async saveBlockPermission(dto: SaveBlockPermissionDto) {
    return this.db
      .insertInto('blockPermissions')
      .values({
        pageId: dto.pageId,
        blockId: dto.blockId,
        userId: dto.userId,
        role: dto.role,
        permission: dto.permission,
      })
      .onConflict((oc) =>
        oc.columns(['blockId', 'userId']).doUpdateSet({
          role: (eb) => eb.ref('excluded.role'),
          permission: (eb) => eb.ref('excluded.permission'),
        }),
      )
      .execute();
  }

  async deleteBlockPermission(dto: { blockId: string; userId: string }) {
    const result = await this.db
      .deleteFrom('blockPermissions')
      .where('blockId', '=', dto.blockId)
      .where('userId', '=', dto.userId)
      .executeTakeFirst();

    return {
      success: true,
      deletedRows: Number(result.numDeletedRows),
    };
  }

  async findPageMember(
    userId: string,
    pageId: string,
  ): Promise<PageMember | null> {
    return this.db
      .selectFrom('pageMembers')
      .selectAll()
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async createPageMember(
    pageId: string,
    userId: string,
    role: string = 'reader',
    source: string = 'block',
  ) {
    return this.db
      .insertInto('pageMembers')
      .values({
        pageId,
        userId,
        role,
        source,
      })
      .execute();
  }

  async findPageById(pageId: string) {
    return this.db
      .selectFrom('pages')
      .select(['spaceId'])
      .where('id', '=', pageId)
      .executeTakeFirstOrThrow();
  }

  async findSpaceMember(userId: string, spaceId: string) {
    return this.db
      .selectFrom('spaceMembers')
      .select('id')
      .where('userId', '=', userId)
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async createSpaceMember(
    spaceId: string,
    userId: string,
    role: string = 'reader',
  ) {
    return this.db
      .insertInto('spaceMembers')
      .values({
        spaceId,
        userId,
        role,
      })
      .execute();
  }

  async findAccessiblePageBlocks(pageId: string, userId: string) {
    return this.db
      .selectFrom('blocks as b')
      .leftJoin('blockPermissions as bp', (join) =>
        join.onRef('b.id', '=', 'bp.blockId').on('bp.userId', '=', userId),
      )
      .leftJoin('blockPermissions as bp_public', (join) =>
        join
          .onRef('b.id', '=', 'bp_public.blockId')
          .on('bp_public.permission', '=', userId),
      )
      .innerJoin('pages as p', 'p.id', 'b.pageId')
      .select([
        'b.id',
        'b.pageId',
        'b.blockType',
        'b.content',
        'b.position',
        'p.creatorId as creatorId',
        'bp.permission as userPermission',
        'bp_public.permission as publicPermission',
        (eb) =>
          eb
            .selectFrom('blockPermissions')
            .select(eb.fn.countAll().as('count'))
            .whereRef('blockPermissions.blockId', '=', 'b.id')
            .as('permissionCount'),
      ])
      .where('b.pageId', '=', pageId)
      .orderBy('b.position')
      .execute();
  }
}
