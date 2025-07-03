import { Injectable } from "@nestjs/common"
import { InjectKysely } from "nestjs-kysely"
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BlockPermissionService } from "./block-permission.service";
import { ShareBlockDto } from "../dto/share-block.dto";
import { getPageId } from "src/collaboration/collaboration.util";
import { signJwt } from '../../../common/helpers/jwt';

@Injectable()
export class BlockShareService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly blockPerm: BlockPermissionService,

  ) {}

  async share(dto: ShareBlockDto, ownerId: string) {
    // 1. выдаём blockPermission
    await this.blockPerm.saveBlockPermission({
      userId: dto.userId,
      blockId: dto.blockId,
      pageId: await getPageId(dto.blockId),
      permission: dto.permission,
      role: 'virtual_reader',
    })

    // 2. при необходимости добавляем Page / Space
    if (dto.includePageMember) { /* insert into pageMembers */ }
    if (dto.includeSpaceMember) { /* insert into spaceMembers */ }

    // 3. Shadow‑page
    const shadowId = crypto.randomUUID()
    await this.db
      .insertInto('shadowPages')
      .values({
        id: shadowId,
        blockId: dto.blockId,
        pageId: await getPageId(dto.blockId),
        createdBy: ownerId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      })
      .execute()

    // 4. JWT
    const token = signJwt({
      s: shadowId,
      b: dto.blockId,
      p: dto.permission,
      exp: dto.expiresAt ? Math.floor(+new Date(dto.expiresAt) / 1000) : undefined,
      sm: dto.showMeta ?? false,
    })

    return { url: `/block/${dto.blockId}?t=${token}` }
  }

  // utils …
}
