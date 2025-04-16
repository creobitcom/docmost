import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable, Logger } from '@nestjs/common';

import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PermissionRepo } from '@docmost/db/repos/permissions/permissions.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { findHighestUserPageRole } from '@docmost/db/repos/page/utils';
import { Permission, User } from '@docmost/db/types/entity.types';

import { SpaceRole, UserRole } from 'src/common/helpers/types/permission';
import {
  IPageAbility,
  PageCaslAction,
  PageCaslSubject,
} from '../interfaces/page-ability.type';
import {
  IPermissionAbility,
  CaslObject,
  CaslAction,
} from '../interfaces/permission-ability.type';
import {
  ISpaceAbility,
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';
import { ALL } from 'dns';
import { CaseNode } from 'kysely';

@Injectable()
export class PermissionAbilityFactory {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly permissionRepo: PermissionRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async createForUserPage(user: User, pageId: string) {
    const spaceId = (await this.pageRepo.findById(pageId)).spaceId;
    const role = await this.getUserSpaceRole(user.id, spaceId);

    if (role === SpaceRole.ADMIN) {
      return buildPageAdminAbility();
    }

    const permissions = await this.permissionRepo.findByPageUserId(
      pageId,
      user.id,
    );
    return buildAbilityFromPermissions(permissions);
  }

  async createForUserSpace(user: User, spaceId: string) {
    const role = await this.getUserSpaceRole(user.id, spaceId);
    Logger.debug(`User role ${role}`);

    if (role === SpaceRole.ADMIN) {
      return buildSpaceAdminAbility();
    }

    const permissions = await this.permissionRepo.findBySpaceUserId(
      spaceId,
      user.id,
    );

    return buildAbilityFromPermissions(permissions);
  }

  async createForUserWorkspace(user: User) {
    return buildWorkspaceAbility(user.role);
  }

  private async getUserSpaceRole(
    userId: string,
    spaceId: string,
  ): Promise<string> {
    const roles = await this.spaceMemberRepo.getUserSpaceRoles(userId, spaceId);
    return findHighestUserPageRole(roles ?? []);
  }

  private async filterUserPermissions(
    userId: string,
    permissions: Permission[],
  ) {
    const checks = await Promise.all(
      permissions.map(async (perm) => {
        const has = await this.permissionRepo.isUserHasPermission(
          userId,
          perm.id,
        );
        return has ? perm : null;
      }),
    );
    return checks.filter(Boolean) as Permission[];
  }
}

function buildAbilityFromPermissions(permissions: Permission[]) {
  const { can, build } = new AbilityBuilder<MongoAbility<IPermissionAbility>>(
    createMongoAbility,
  );
  permissions.forEach((perm) => can(perm.action, perm.object));
  return build();
}

function buildPageAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPermissionAbility>>(
    createMongoAbility,
  );
  can(CaslAction.Manage, CaslObject.Members);
  can(CaslAction.Manage, CaslObject.Page);
  return build();
}

function buildSpaceAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPermissionAbility>>(
    createMongoAbility,
  );
  can(CaslAction.Manage, CaslObject.Settings);
  can(CaslAction.Manage, CaslObject.Members);
  can(CaslAction.Manage, CaslObject.Page);
  can(CaslAction.Read, CaslObject.Space);
  return build();
}

function buildWorkspaceAbility(role: string) {
  const { can, build } = new AbilityBuilder<MongoAbility<IPermissionAbility>>(
    createMongoAbility,
  );
  if (role === UserRole.OWNER) {
    can(CaslAction.Manage, CaslObject.Permission);
  }
  return build();
}
