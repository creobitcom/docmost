import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  BadRequestException,
  Body,
  Query,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreatePermissionDto } from './dto/create.dto';
import { PermissionService } from './services/permission.service';
import { PermissionAbilityFactory } from '../casl/abilities/permission-ability.factory';
import {
  CaslAction,
  CaslObject,
  PageCaslObject,
  SpaceCaslObject,
  WorkspaceCaslAction,
  WorkspaceCaslObject,
} from '../casl/interfaces/permission-ability.type';
import { AuthWorkspace } from 'src/common/decorators/auth-workspace.decorator';
import {
  GetPermissionDto,
  PermissionDto,
  PermissionIdDto,
} from './dto/permission.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { PageCaslAction } from '../casl/interfaces/page-ability.type';
import { SpaceCaslAction } from '../casl/interfaces/space-ability.type';

@UseGuards(JwtAuthGuard)
@Controller('permission')
export class PermissionController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly permissionAbility: PermissionAbilityFactory,
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly userRepo: UserRepo,
    private readonly groupRepo: GroupRepo,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async create(
    @Body() dto: CreatePermissionDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!dto.pageId || dto.pageId.length === 0) &&
      (!dto.spaceId || dto.spaceId.length === 0)
    ) {
      throw new BadRequestException('spaceId or pageId is required');
    }

    if (
      (!dto.groupId || dto.groupId.length === 0) &&
      (!dto.userId || dto.userId.length === 0)
    ) {
      throw new BadRequestException('groupId or userId is required');
    }

    const ability = await this.permissionAbility.createForUserWorkspace(user);
    this.ensurePermission(
      ability,
      WorkspaceCaslAction.Manage,
      WorkspaceCaslObject.Permission,
    );

    return this.permissionService.create(dto, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Get('')
  async findByTargetId(
    @Query() dto: GetPermissionDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.ensureTargetExists(dto, workspace);

    const ability =
      dto.type === CaslObject.Page
        ? await this.permissionAbility.createForUserPage(user, dto.targetId)
        : await this.permissionAbility.createForUserSpace(user, dto.targetId);

    if (
      ability.cannot(PageCaslAction.Manage, PageCaslObject.Permission) &&
      ability.cannot(SpaceCaslAction.Manage, SpaceCaslObject.Permission)
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage permissions',
      );
    }

    const permissions =
      dto.type === CaslObject.Page
        ? await this.permissionService.findByPageId(dto.targetId)
        : await this.permissionService.findBySpaceId(dto.targetId);

    return this.groupPermissionsByMember(permissions, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Delete()
  async delete(@Body() dto: PermissionIdDto, @AuthUser() user: User) {
    const permission = await this.permissionService.findById(dto.id);
    if (!permission) throw new NotFoundException('Permission not found');

    const ability = await this.permissionAbility.createForUserWorkspace(user);
    this.ensurePermission(
      ability,
      WorkspaceCaslAction.Manage,
      CaslObject.Permission,
    );

    return this.permissionService.delete(dto.id);
  }

  private ensurePermission(ability: any, action: string, subject: string) {
    if (ability.cannot(action, subject)) {
      throw new ForbiddenException();
    }
  }

  private async ensureTargetExists(
    dto: GetPermissionDto,
    workspace: Workspace,
  ) {
    if (dto.type === CaslObject.Page) {
      const page = await this.pageRepo.findById(dto.targetId);
      if (!page) throw new NotFoundException('Page not found');
    } else {
      const space = await this.spaceRepo.findById(dto.targetId, workspace.id);
      if (!space) throw new NotFoundException('Space not found');
    }
  }

  private async groupPermissionsByMember(
    permissions: PermissionDto[],
    workspaceId: string,
  ) {
    const grouped = new Map<string, any>();

    for (const permission of permissions) {
      if (permission.userId) {
        const user = await this.userRepo.findById(
          permission.userId,
          workspaceId,
        );
        if (!user) continue;

        if (!grouped.has(user.id)) {
          grouped.set(user.id, {
            type: 'user',
            userId: user.id,
            name: user.name,
            userAvatarUrl: user.avatarUrl,
            userEmail: user.email,
            permissions: [permission],
          });
        } else {
          grouped.get(user.id).permissions.push(permission);
        }
      } else if (permission.groupId) {
        const group: any = await this.groupRepo.findById(
          permission.groupId,
          workspaceId,
          {
            includeMemberCount: true,
          },
        );
        if (!group) continue;

        if (!grouped.has(group.id)) {
          grouped.set(group.id, {
            type: 'group',
            groupId: group.id,
            name: group.name,
            memberCount: group.memberCount,
            permissions: [permission],
          });
        } else {
          grouped.get(group.id).permissions.push(permission);
        }
      }
    }

    return Array.from(grouped.values());
  }
}
