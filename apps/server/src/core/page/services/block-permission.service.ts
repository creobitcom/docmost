import { Injectable } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';

@Injectable()
export class BlockPermissionService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

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

async getAccessiblePageBlocks(pageId: string, userId: string) {
  console.log('[PageService] Получение доступных блоков для страницы:', pageId, 'пользователя:', userId);

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
      'p.creator_id as creatorId',
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

  const result = blocks.map((block) => {
    const hasAccess =
      !!block.userPermission ||
      !!block.publicPermission ||
      block.creatorId === userId ||
      block.permissionCount === 0;

    return {
      id: block.id,
      pageId: block.pageId,
      blockType: block.blockType,
      position: block.position,
      userPermission: block.userPermission ?? block.publicPermission ?? (block.creatorId === userId ? 'owner' : null),
      content: hasAccess ? block.content : null,
    };
  });

  return result;
}
}