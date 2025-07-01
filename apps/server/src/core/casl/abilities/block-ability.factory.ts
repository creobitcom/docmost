import { Injectable } from '@nestjs/common';
import { BlockPermissionRepo } from '@docmost/db/repos/block/block-permission.repo';
import {
  BlockAbility,
  BlockAbilityAction,
  UserBlockRole,
} from '../../../core/casl/interfaces/block-ability.type';

@Injectable()
export class BlockAbilityFactory {
  constructor(private readonly blockPermissionRepo: BlockPermissionRepo) {}

  async createForBlock(userId: string, blockId: string): Promise<BlockAbility> {
    const roles = await this.blockPermissionRepo.getUserBlockRoles(
      userId,
      blockId,
    );

    if (!roles) {
      return { blockId, actions: [] };
    }

    const actions = this.mapRolesToActions(roles);

    return {
      blockId,
      actions,
    };
  }

  private mapRolesToActions(roles: UserBlockRole[]): BlockAbilityAction[] {
    const actionSet = new Set<BlockAbilityAction>();

    for (const role of roles) {
      if (role === 'admin') {
        actionSet.add('read');
        actionSet.add('update');
        actionSet.add('delete');
      } else if (role === 'writer') {
        actionSet.add('read');
        actionSet.add('update');
      } else if (role === 'reader') {
        actionSet.add('read');
      }
    }

    return Array.from(actionSet);
  }
}
