import { Injectable, Logger } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { BlockPermissionRepo } from '@docmost/db/repos/block/block-permission.repo';

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

  async getAccessiblePageBlocks(pageId: string, userId: string) {
    const hasPageAccess = await this.userHasDirectPageAccess(userId, pageId);

    const blocks = await this.blockPermissionRepo.findAccessiblePageBlocks(
      pageId,
      userId,
    );

    const pageMember = await this.blockPermissionRepo.findPageMember(
      userId,
      pageId,
    );

    const hasDirectPageAccess = pageMember?.source === 'manual';

    return blocks.map((block) => {
      const userIsCreator = block.creatorId === userId;

      const hasBlockAccess = !!block.userPermission || userIsCreator;

      const isPublic = !!block.publicPermission;
      const isUnrestricted = block.permissionCount === 0;

      const hasAccess = hasDirectPageAccess
        ? hasBlockAccess || isPublic || isUnrestricted
        : hasBlockAccess;

      return {
        id: block.id,
        pageId: block.pageId,
        blockType: block.blockType,
        position: block.position,
        hasAccess,
        userPermission:
          block.userPermission ??
          (hasPageAccess &&
            (block.publicPermission ?? (userIsCreator ? 'owner' : null))),
        content: hasAccess ? block.content : null,
      };
    });
  }

  async userHasDirectPageAccess(
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
