import { Injectable } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';

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
      .execute();
  }
  async canAccessBlock(userId: string, pageId: string, blockId: string, required: 'read' | 'edit' | 'owner') {
    const result = await this.db.selectFrom('blockPermissions')
      .select(['permission'])
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .where('blockId', '=', blockId)
      .executeTakeFirst();

    if (!result) return false;

    const permissionLevels = ['read', 'edit', 'owner'];
    return (
      permissionLevels.indexOf(result.permission) >= permissionLevels.indexOf(required)
    );
  }
  async getUserReadableBlockIds(userId: string, pageId: string): Promise<string[]> {
    const result = await this.db
      .selectFrom('blockPermissions')
      .select(['blockId'])
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .where('permission', 'in', ['read', 'edit', 'full']) // допускаем все
      .execute();

    return result.map(r => r.blockId);
  }
}

