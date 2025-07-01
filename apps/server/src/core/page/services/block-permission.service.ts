import { Injectable, Logger } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { BlockPermissionRepo } from '@docmost/db/repos/block/block-permission.repo';
import { Block } from '@docmost/db/types/entity.types';

@Injectable()
export class BlockPermissionService {
  constructor(private readonly blockPermissionRepo: BlockPermissionRepo) {}

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
    return this.blockPermissionRepo.saveBlockPermission(dto);
  }

  async saveBlockPermissionWithCascade(dto: SaveBlockPermissionDto) {
    await this.blockPermissionRepo.saveBlockPermission(dto);

    const existingPageMember = await this.blockPermissionRepo.findPageMember(
      dto.userId,
      dto.pageId,
    );

    if (!existingPageMember) {
      await this.blockPermissionRepo.createPageMember(
        dto.pageId,
        dto.userId,
        'reader',
        'block',
      );
    }

    const page = await this.blockPermissionRepo.findPageById(dto.pageId);

    const existingSpaceMember = await this.blockPermissionRepo.findSpaceMember(
      dto.userId,
      page.spaceId,
    );

    if (!existingSpaceMember) {
      await this.blockPermissionRepo.createSpaceMember(
        page.spaceId,
        dto.userId,
        'reader',
      );
    }
  }

  async deleteBlockPermission(dto: { blockId: string; userId: string }) {
    return this.blockPermissionRepo.deleteBlockPermission(dto);
  }

  async getAccessiblePageBlocks(
    pageId: string,
    userId: string,
  ): Promise<{ id: string; hasAccess: boolean }[]> {
    const hasPageAccess = await this.userHasDirectPageAccess(userId, pageId);

    const blocks = await this.blockPermissionRepo.findAccessiblePageBlocks(
      pageId,
      userId,
    );

    const pageMember = await this.blockPermissionRepo.findPageMember(
      userId,
      pageId,
    );

    return blocks.map((block) => {
      const hasBlockAccess = !!block.userPermission;

      const isPublic = !!block.publicPermission;
      const isUnrestricted = block.permissionCount === 0;

      const hasAccess = hasPageAccess
        ? hasBlockAccess || isPublic || isUnrestricted
        : hasBlockAccess;

      return { id: block.id, hasAccess };
    });
  }

  private async userHasDirectPageAccess(
    userId: string,
    pageId: string,
  ): Promise<boolean> {
    const result = await this.blockPermissionRepo.findPageMember(
      userId,
      pageId,
    );

    const hasAccess = !!result;
    Logger.debug(
      `PageMember exists for user ${userId} on page ${pageId}: ${hasAccess}`,
      'BlockPermissionService',
    );
    return hasAccess;
  }
}
