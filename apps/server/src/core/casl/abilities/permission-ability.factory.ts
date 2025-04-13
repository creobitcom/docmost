import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { PageMemberRepo } from '@docmost/db/repos/page/page-member.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { findHighestUserPageRole } from '@docmost/db/repos/page/utils';
import { PermissionRepo } from '@docmost/db/repos/permissions/permissions.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { Permission, User } from '@docmost/db/types/entity.types';
import { Injectable, Logger } from '@nestjs/common';
import { SpaceRole, UserRole } from 'src/common/helpers/types/permission';
import {
  PageCaslAction,
  PageCaslSubject,
} from '../interfaces/page-ability.type';
import {
  IPermissionAbility,
  SpaceCaslAction,
  CaslSubject,
  CaslAction,
} from '../interfaces/permission-ability.type';
import {
  ISpaceAbility,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';
import { ID } from 'yjs';

@Injectable()
export class PermissionAbilityFactory {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly permissionRepo: PermissionRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async createForUserPage(user: User, pageId: string) {
    const spaceId = (await this.pageRepo.findById(pageId)).spaceId;
    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      spaceId,
    );

    const userSpaceRole = findHighestUserPageRole(
      userSpaceRoles ? userSpaceRoles : [],
    );

    if (userSpaceRole == SpaceRole.ADMIN) {
      return buildPageAdminAbility();
    }

    const userPagePermissions = await this.permissionRepo.findByPageUserId(
      pageId,
      user.id,
    );
    Logger.debug(userPagePermissions);

    Logger.debug(
      `User permissions: ${JSON.stringify(userPagePermissions)}`,
      'Permissions-ability',
    );

    return buildAbilityFromPermissions(userPagePermissions);
  }

  async createForUserSpace(user: User, spaceId: string) {
    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      spaceId,
    );

    const userSpaceRole = findHighestUserPageRole(
      userSpaceRoles ? userSpaceRoles : [],
    );

    if (userSpaceRole == SpaceRole.ADMIN) {
      return buildSpaceAdminAbility();
    }

    const spacePremissions = await this.permissionRepo.findByPageUserId(
      spaceId,
      user.id,
    );
    Logger.debug(spacePremissions);

    const userSpacePermissons = [];

    for (const permission of spacePremissions) {
      if (this.permissionRepo.isUserHasPermission(user.id, permission.id)) {
        userSpacePermissons.push(permission);
      }
    }

    Logger.debug(
      `User permissions: ${JSON.stringify(userSpacePermissons)}`,
      'Permissions-ability',
    );

    return buildAbilityFromPermissions(userSpacePermissons);
  }

  async createForUserWorkspace(user: User) {
    Logger.debug(`User workspace role: ${user.role}`);

    return buildWorkspaceAbility(user.role);
  }
}

function buildAbilityFromPermissions(userPagePermissions: Permission[]) {
  const { can, build } = new AbilityBuilder<MongoAbility<IPermissionAbility>>(
    createMongoAbility,
  );

  for (const permission of userPagePermissions) {
    can(permission.name, CaslSubject.Page);
  }

  return build();
}

function buildPageAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPermissionAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Manage, PageCaslSubject.Member);
  can(PageCaslAction.Manage, PageCaslSubject.Page);
  return build();
}

function buildSpaceAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPermissionAbility>>(
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

  if (role == UserRole.OWNER) {
    can(CaslAction.Manage, CaslSubject.Permission);
  }

  return build();
}
