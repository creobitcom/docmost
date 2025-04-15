import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';

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

    if (role === SpaceRole.ADMIN) {
      return buildSpaceAdminAbility();
    }

    const allPermissions = await this.permissionRepo.findByPageUserId(
      spaceId,
      user.id,
    );
    const filteredPermissions = await this.filterUserPermissions(
      user.id,
      allPermissions,
    );

    return buildAbilityFromPermissions(filteredPermissions);
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
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Manage, PageCaslSubject.Member);
  can(PageCaslAction.Manage, PageCaslSubject.Page);
  return build();
}

function buildSpaceAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(
    createMongoAbility,
  );
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
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
