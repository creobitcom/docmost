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

  async createForUser(userId: string, blockId: string) {
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
