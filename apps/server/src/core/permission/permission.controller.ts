import { Permission, User, Workspace } from '@docmost/db/types/entity.types';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
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
  CaslSubject,
} from '../casl/interfaces/permission-ability.type';
import { AuthWorkspace } from 'src/common/decorators/auth-workspace.decorator';
import { PermissionDto, PermissionIdDto } from './dto/permission.dto';
import { PageIdDto } from '../comment/dto/comments.input';
import { SpaceService } from '../space/services/space.service';
import { PageService } from '../page/services/page.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';

@UseGuards(JwtAuthGuard)
@Controller('permission')
export class PermissionController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly permissionAbility: PermissionAbilityFactory,
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
    private readonly groupRepo: GroupRepo,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/create')
  async create(
    @Body() createPermissionDto: CreatePermissionDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!createPermissionDto.pageId || createPermissionDto.pageId.length == 0) &&
      (!createPermissionDto.spaceId || createPermissionDto.spaceId.length == 0)
    ) {
      throw new BadRequestException('pageId or spaceId is required');
    }

    if (
      (!createPermissionDto.userId || createPermissionDto.userId.length == 0) &&
      (!createPermissionDto.groupId || createPermissionDto.groupId.length == 0)
    ) {
      throw new BadRequestException('userId or groupId is required');
    }

    const permissionsAbility =
      await this.permissionAbility.createForUserWorkspace(user);

    if (permissionsAbility.cannot(CaslAction.Manage, CaslSubject.Permission)) {
      throw new ForbiddenException();
    }

    return await this.permissionService.create(
      createPermissionDto,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('/page')
  async findByPageId(
    @Body() pageIdDto: PageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(pageIdDto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const permissionsAbility = await this.permissionAbility.createForUserPage(
      user,
      pageIdDto.pageId,
    );

    if (permissionsAbility.cannot(CaslAction.Read, CaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const pagePermissons = await this.permissionService.findByPageId(
      pageIdDto.pageId,
    );

    const permissionsByMembers: Map<
      string,
      {
        type: 'user' | 'group';
        name: string;
        userId?: string;
        userAvatarUrl?: string;
        userEmail?: string;
        groupId?: string;
        memberCount?: number;
        permissions: PermissionDto[];
      }
    > = new Map();

    for (const permission of pagePermissons) {
      if (permission.userId) {
        const user = await this.userRepo.findById(
          permission.userId,
          workspace.id,
        );
        if (!user) {
          continue;
        }
        if (!permissionsByMembers.has(user.id)) {
          permissionsByMembers.set(user.id, {
            type: 'user',
            name: user.name,
            userId: user.id,
            userAvatarUrl: user.avatarUrl,
            userEmail: user.email,
            permissions: [permission],
          });
        } else {
          permissionsByMembers.get(user.id).permissions.push(permission);
        }
      } else {
        const group = await this.groupRepo.findById(
          permission.groupId,
          workspace.id,
          { includeMemberCount: true },
        );
        if (!group) {
          continue;
        }
        if (!permissionsByMembers.has(group.id)) {
          permissionsByMembers.set(group.id, {
            type: 'group',
            groupId: group.id,
            name: group.name,
            permissions: [permission],
            ...group,
          });
        } else {
          permissionsByMembers.get(group.id).permissions.push(permission);
        }
      }
    }

    return Array.from(permissionsByMembers.values());
  }

  @HttpCode(HttpStatus.OK)
  @Post('/delete')
  async delete(@Body() dto: PermissionIdDto, @AuthUser() user: User) {
    const permission = await this.permissionService.findById(dto.id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    const permissionsAbility =
      await this.permissionAbility.createForUserWorkspace(user);

    if (permissionsAbility.cannot(CaslAction.Manage, CaslSubject.Permission)) {
      throw new ForbiddenException();
    }

    return await this.permissionService.delete(dto.id);
  }
}
