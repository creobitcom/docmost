import { Injectable } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { DbService } from '../../../database/services/db.service';

@Injectable()
export class BlockPermissionService {
  constructor(private readonly db: DbService) {}

  async saveBlockPermission(dto: SaveBlockPermissionDto) {
    return this.db.db
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
