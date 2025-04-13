import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
  CaslSubject,
} from '../casl/interfaces/permission-ability.type';
import { AuthWorkspace } from 'src/common/decorators/auth-workspace.decorator';
import { PermissionIdDto } from './dto/permission.dto';

@UseGuards(JwtAuthGuard)
@Controller('permission')
export class PermissionController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly permissionAbility: PermissionAbilityFactory,
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
