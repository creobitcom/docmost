import {
  AbilityBuilder,
  AbilityTuple,
  createMongoAbility,
  MongoAbility,
  MongoQuery,
} from '@casl/ability';
import { Injectable, Logger } from '@nestjs/common';

import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PermissionRepo } from '@docmost/db/repos/permissions/permissions.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { findHighestUserPageRole } from '@docmost/db/repos/page/utils';
import { Permission, User } from '@docmost/db/types/entity.types';

import { SpaceRole, UserRole } from 'src/common/helpers/types/permission';
import {
  IPagePermissionAbility,
  PageCaslObject,
  SpaceCaslObject,
  WorkspaceCaslAction,
  WorkspaceCaslObject,
  PageCaslAction,
  SpaceCaslAction,
  ISpacePermissionAbility,
  IWorkspacePermissionAbility,
} from '../interfaces/permission-ability.type';

type AbilityType = 'page' | 'space' | 'workspace';

@Injectable()
export class PermissionAbilityFactory {
  private readonly logger = new Logger(PermissionAbilityFactory.name);
  private readonly abilityCache = new Map<string, any>();
  private readonly CACHE_TTL = 5 * 1000;

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly permissionRepo: PermissionRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async createForUserPage(user: User, pageId: string) {
    const cacheKey = `page:${user.id}:${pageId}`;
    const cachedAbility = this.getFromCache(cacheKey);
    if (cachedAbility) return cachedAbility;

    const page = await this.pageRepo.findById(pageId);
    const spaceId = page.spaceId;
    const role = await this.getUserSpaceRole(user.id, spaceId);

    let ability: MongoAbility<IPagePermissionAbility, MongoQuery>;
    if (role === SpaceRole.ADMIN) {
      ability = buildPageAdminAbility();
    } else {
      const permissions = await this.permissionRepo.findByPageUserId(
        pageId,
        user.id,
      );
      ability = this.buildPageAbilityFromPermissions(permissions);
    }

    this.addToCache(cacheKey, ability);
    return ability;
  }

  async createForUserSpace(user: User, spaceId: string) {
    const cacheKey = `space:${user.id}:${spaceId}`;
    const cachedAbility = this.getFromCache(cacheKey);
    if (cachedAbility) return cachedAbility;

    const role = await this.getUserSpaceRole(user.id, spaceId);

    let ability: MongoAbility<ISpacePermissionAbility, MongoQuery>;
    if (role === SpaceRole.ADMIN) {
      ability = buildSpaceAdminAbility();
    } else {
      const permissions = await this.permissionRepo.findBySpaceUserId(
        spaceId,
        user.id,
      );
      ability = this.buildSpaceAbilityFromPermissions(permissions);
    }

    this.addToCache(cacheKey, ability);
    return ability;
  }

  async createForUserWorkspace(user: User) {
    const cacheKey = `workspace:${user.id}`;
    const cachedAbility = this.getFromCache(cacheKey);
    if (cachedAbility) return cachedAbility;

    const ability = buildWorkspaceAbility(user.role);
    this.addToCache(cacheKey, ability);
    return ability;
  }

  private buildPageAbilityFromPermissions(permissions: Permission[]) {
    const { can, build } = new AbilityBuilder<
      MongoAbility<IPagePermissionAbility>
    >(createMongoAbility);
    permissions.forEach((permission) => {
      const permissionObject =
        PageCaslObject[
          permission.object.charAt(0).toUpperCase() + permission.object.slice(1)
        ];

      const permissionAction =
        PageCaslAction[
          permission.action.charAt(0).toUpperCase() + permission.action.slice(1)
        ];
      can(permissionAction, permissionObject);
    });
    return build();
  }

  private buildSpaceAbilityFromPermissions(permissions: Permission[]) {
    const { can, build } = new AbilityBuilder<
      MongoAbility<ISpacePermissionAbility>
    >(createMongoAbility);
    permissions.forEach((permission) => {
      const permissionObject =
        SpaceCaslObject[
          permission.object.charAt(0).toUpperCase() + permission.object.slice(1)
        ];

      const permissionAction =
        SpaceCaslAction[
          permission.action.charAt(0).toUpperCase() + permission.action.slice(1)
        ];

      can(permissionAction, permissionObject);
    });
    return build();
  }

  private isValidEnumKey(
    key: string,
    enumObject: Record<string, string>,
  ): key is keyof typeof enumObject {
    return Object.keys(enumObject).includes(key);
  }

  private async getUserSpaceRole(
    userId: string,
    spaceId: string,
  ): Promise<string> {
    const roles = await this.spaceMemberRepo.getUserSpaceRoles(userId, spaceId);
    return findHighestUserPageRole(roles ?? []);
  }

  private getFromCache(key: string) {
    const cacheItem = this.abilityCache.get(key);
    if (cacheItem && cacheItem.expiry > Date.now()) {
      return cacheItem.value;
    }
    return null;
  }

  private addToCache(key: string, value: any) {
    this.abilityCache.set(key, {
      value,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }
}

function buildPageAdminAbility() {
  const { can, build } = new AbilityBuilder<
    MongoAbility<IPagePermissionAbility>
  >(createMongoAbility);
  can(PageCaslAction.Read, PageCaslObject.Content);
  can(PageCaslAction.Edit, PageCaslObject.Content);
  can(PageCaslAction.Delete, PageCaslObject.Page);
  can(PageCaslAction.Manage, PageCaslObject.Permission);
  can(PageCaslAction.Manage, PageCaslObject.Page);
  return build();
}

function buildSpaceAdminAbility() {
  const { can, build } = new AbilityBuilder<
    MongoAbility<ISpacePermissionAbility>
  >(createMongoAbility);
  can(SpaceCaslAction.Create, SpaceCaslObject.Page);
  can(SpaceCaslAction.Edit, SpaceCaslObject.Page);
  can(SpaceCaslAction.View, SpaceCaslObject.Space);
  can(SpaceCaslAction.Delete, SpaceCaslObject.Space);
  can(SpaceCaslAction.Manage, SpaceCaslObject.Permission);
  can(SpaceCaslAction.Manage, SpaceCaslObject.Space);
  return build();
}

function buildWorkspaceAbility(role: string) {
  const { can, build } = new AbilityBuilder<
    MongoAbility<IWorkspacePermissionAbility>
  >(createMongoAbility);
  if (role === UserRole.OWNER || role === UserRole.ADMIN) {
    can(WorkspaceCaslAction.Manage, WorkspaceCaslObject.Permission);
  }
  return build();
}
