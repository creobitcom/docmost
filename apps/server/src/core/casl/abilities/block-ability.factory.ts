import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BlockPermissionRepo } from '@docmost/db/repos/block/block-permission.repo';
import {
  BlockCaslAction,
  BlockCaslSubject,
  IBlockAbility,
} from '../interfaces/block-ability.type';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';

@Injectable()
export class BlockAbilityFactory {
  constructor(private readonly blockPermissionRepo: BlockPermissionRepo) {}

  async createForUser(userId: string, blockId: string, pageId: string) {
    const blockHasPermissions = await this.blockHasAnyPermissions(blockId);

    if (blockHasPermissions) {
      const userBlockRole = await this.blockPermissionRepo.getUserBlockRoles(
        userId,
        blockId,
      );

      switch (userBlockRole) {
        case 'admin':
          return buildBlockAdminAbility();
        case 'writer':
          return buildBlockWriterAbility();
        case 'reader':
          return buildBlockReaderAbility();
        default:
          return buildBlockNoAccessAbility();
      }
    }

    return buildBlockAdminAbility();
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

  private async blockHasAnyPermissions(blockId: string): Promise<boolean> {
    const permissions =
      await this.blockPermissionRepo.findBlockPermissions(blockId);
    return permissions && permissions.length > 0;
  }
}

function buildBlockAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IBlockAbility>>(
    createMongoAbility,
  );
  can(BlockCaslAction.Manage, BlockCaslSubject.Block);
  return build();
}

function buildBlockWriterAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IBlockAbility>>(
    createMongoAbility,
  );
  can(BlockCaslAction.Manage, BlockCaslSubject.Block);
  return build();
}

function buildBlockReaderAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IBlockAbility>>(
    createMongoAbility,
  );
  can(BlockCaslAction.Read, BlockCaslSubject.Block);
  return build();
}

function buildBlockNoAccessAbility() {
  const { build } = new AbilityBuilder<MongoAbility<IBlockAbility>>(
    createMongoAbility,
  );
  return build();
}
