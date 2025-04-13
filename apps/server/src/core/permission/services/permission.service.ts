import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePermissionDto } from '../dto/create.dto';
import { Permission, User } from '@docmost/db/types/entity.types';
import { PermissionRepo } from '@docmost/db/repos/permissions/permissions.repo';
import { PermissionAbilityFactory } from 'src/core/casl/abilities/permission-ability.factory';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';

@Injectable()
export class PermissionService {
  constructor(
    private readonly permissionRepo: PermissionRepo,
    private readonly permissionAbility: PermissionAbilityFactory,
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  async create(
    permission: CreatePermissionDto,
    user: User,
    workspaceId: string,
  ): Promise<Permission> {
    const page = await this.pageRepo.findById(permission.pageId);
    const space = await this.spaceRepo.findById(
      permission.spaceId,
      workspaceId,
    );

    if (!page && !space) {
      throw new NotFoundException();
    }

    return this.permissionRepo.createPermission({
      addedById: user.id,
      name: permission.name,
      userId: permission?.userId,
      groupId: permission?.groupId,
      pageId: page?.id,
      spaceId: space?.id,
    });
  }

  async delete(id: string) {
    await this.permissionRepo.hardDelete(id);
  }

  async findById(id: string) {
    return this.permissionRepo.findById(id);
  }
}
