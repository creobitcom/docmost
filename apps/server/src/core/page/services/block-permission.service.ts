import { Injectable } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';

@Injectable()
export class BlockPermissionService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async updateBlockPermission({
    userId,
    pageId,
    blockId,
    permission,
    role,
  }: {
    userId: string;
    pageId: string;
    blockId: string;
    permission: 'read' | 'edit' | 'owner';
    role: string;
  }) {
    return this.saveBlockPermissionWithCascade({
      userId,
      pageId,
      blockId,
      permission,
      role,
    });
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
        })
      )
      .execute();
  }

  async saveBlockPermissionWithCascade(dto: SaveBlockPermissionDto) {
    // 1. Saving block permission
    await this.saveBlockPermission(dto);

    // 2. Checking — page permission
    const existingPageMember = await this.db
      .selectFrom('pageMembers')
      .select('id')
      .where('userId', '=', dto.userId)
      .where('pageId', '=', dto.pageId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!existingPageMember) {
      await this.db.insertInto('pageMembers').values({
        pageId: dto.pageId,
        userId: dto.userId,
        role: 'reader', // min access
        source: 'block',
      }).execute();
    }

    // 3. Getting space Id for page
    const page = await this.db
      .selectFrom('pages')
      .select(['spaceId'])
      .where('id', '=', dto.pageId)
      .executeTakeFirstOrThrow();

    // 4. Checking — space access
    const existingSpaceMember = await this.db
      .selectFrom('spaceMembers')
      .select('id')
      .where('userId', '=', dto.userId)
      .where('spaceId', '=', page.spaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!existingSpaceMember) {
      await this.db.insertInto('spaceMembers').values({
        spaceId: page.spaceId,
        userId: dto.userId,
        role: 'reader', // min access
      }).execute();
    }
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

  async getAccessiblePageBlocks(pageId: string, userId: string) {
    const hasPageAccess = await this.userHasDirectPageAccess(userId, pageId);

    const blocks = await this.db
      .selectFrom('blocks as b')
      .leftJoin('blockPermissions as bp', (join) =>
        join.onRef('b.id', '=', 'bp.blockId').on('bp.userId', '=', sql.lit(userId))
      )
      .leftJoin('blockPermissions as bp_public', (join) =>
        join.onRef('b.id', '=', 'bp_public.blockId').on('bp_public.permission', '=', sql.lit('public'))
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

      const pageMember = await this.db
      .selectFrom('pageMembers')
      .select(['id', 'source'])
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    const hasDirectPageAccess = pageMember?.source === 'manual';


    console.log(`[AccessCalc] hasPageAccess = ${hasPageAccess}`);
    return blocks.map((block) => {
      const userIsCreator = block.creatorId === userId;

      const hasBlockAccess =
        !!block.userPermission || userIsCreator;

      const isPublic = !!block.publicPermission;
      const isUnrestricted = block.permissionCount === 0;

      const hasAccess = hasDirectPageAccess
          ? hasBlockAccess || isPublic || isUnrestricted
          : hasBlockAccess;


      console.log(`[AccessCalc] Block ${block.id}: hasBlockAccess=${hasBlockAccess}, isPublic=${isPublic}, isUnrestricted=${isUnrestricted}, finalHasAccess=${hasAccess}`);

      return {
        id: block.id,
        pageId: block.pageId,
        blockType: block.blockType,
        position: block.position,
        hasAccess,
        userPermission:
          block.userPermission ??
          (hasPageAccess && (block.publicPermission ?? (userIsCreator ? 'owner' : null))),
        content: hasAccess ? block.content : null,
      };
    });
  }

  async userHasDirectPageAccess(userId: string, pageId: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('pageMembers')
      .select('id')
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    const hasAccess = !!result;
    console.log(`[AccessCheck] PageMember exists for user ${userId} on page ${pageId}:`, hasAccess);
    return hasAccess;
  }

}
