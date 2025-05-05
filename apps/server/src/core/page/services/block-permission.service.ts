import { Injectable } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class BlockPermissionService {
  constructor(@InjectKysely() db: KyselyDB) {}

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
        oc.columns(['pageId', 'blockId', 'userId']).doUpdateSet({
          role: dto.role,
        }),
      )
      .execute();
  }
}
