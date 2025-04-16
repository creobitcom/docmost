import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PageService } from './services/page.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';
import { PageHistoryIdDto, PageIdDto, PageInfoDto } from './dto/page.dto';
import { PageHistoryService } from './services/page-history.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceMember, User, Workspace } from '@docmost/db/types/entity.types';
import { SidebarPageDto } from './dto/sidebar-page.dto';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { RecentPageDto } from './dto/recent-page.dto';
import PageAbilityFactory from '../casl/abilities/page-ability.factory';
import { AddPageMembersDto } from './dto/add-page-member.dto';
import { PageMemberService } from './services/page-member.service';
import { RemovePageMemberDto } from './dto/remove-page-member.dto';
import { UpdatePageMemberRoleDto } from './dto/update-page-member-role.dto';
import { SpaceRole } from 'src/common/helpers/types/permission';
import { PermissionAbilityFactory } from '../casl/abilities/permission-ability.factory';
import {
  CaslAction,
  CaslObject,
} from '../casl/interfaces/permission-ability.type';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly pageMemberService: PageMemberService,
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly pageHistoryService: PageHistoryService,
    private readonly permissionAbility: PermissionAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getPage(@Body() dto: PageInfoDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(dto.pageId, {
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageAbility = await this.permissionAbility.createForUserPage(
      user,
      page.id,
    );

    if (pageAbility.cannot(CaslAction.Read, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    const membership = {
      userId: user.id,
      permissions: pageAbility.rules,
    };

    return { ...page, membership };
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() createPageDto: CreatePageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.spaceRepo.findById(
      createPageDto.spaceId,
      workspace.id,
    );
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const ability = await this.permissionAbility.createForUserSpace(
      user,
      space.id,
    );

    if (ability.cannot(CaslAction.Create, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageService.create(user.id, workspace.id, createPageDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() updatePageDto: UpdatePageDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(updatePageDto.pageId);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageAbility = await this.permissionAbility.createForUserPage(
      user,
      updatePageDto.pageId,
    );

    if (pageAbility.cannot(CaslAction.Edit, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageService.update(
      updatePageDto.pageId,
      updatePageDto,
      user.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() pageIdDto: PageIdDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(pageIdDto.pageId);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.permissionAbility.createForUserPage(
      user,
      page.id,
    );

    if (ability.cannot(CaslAction.Delete, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    await this.pageService.forceDelete(pageIdDto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('restore')
  async restore(@Body() pageIdDto: PageIdDto) {
    //  await this.pageService.restore(deletePageDto.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getPageMembers(
    @Body() pageIdDto: PageIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const ability = await this.permissionAbility.createForUserPage(
      user,
      pageIdDto.pageId,
    );

    if (ability.cannot(CaslAction.Read, CaslObject.Members)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.getPageMembers(pageIdDto.pageId, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  async addPageMember(
    @Body() dto: AddPageMembersDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!dto.userIds || dto.userIds.length === 0) &&
      (!dto.groupIds || dto.groupIds.length === 0)
    ) {
      throw new BadRequestException('userIds or groupIds is required');
    }

    const ability = await this.permissionAbility.createForUserPage(
      user,
      dto.pageId,
    );

    if (ability.cannot(CaslAction.Manage, CaslObject.Members)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.addMembersToPageBatch(
      dto,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('recent')
  async getRecentPages(
    @Body() recentPageDto: RecentPageDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const recentPages: { items: Array<any>; meta: any } =
      await this.pageService.getRecentPages(user.id, pagination);

    return {
      items: await Promise.all(
        recentPages.items.map(async (page) => {
          try {
            const ability = await this.permissionAbility.createForUserPage(
              user,
              page.id,
            );
            return ability.can(CaslAction.Read, CaslObject.Page) ? page : null;
          } catch (err) {
            return null;
          }
        }),
      ).then((items) => items.filter(Boolean)),
      meta: recentPages.meta,
    };
  }

  // TODO: scope to workspaces
  @HttpCode(HttpStatus.OK)
  @Post('/history')
  async getPageHistory(
    @Body() dto: PageIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);

    const ability = await this.permissionAbility.createForUserPage(
      user,
      dto.pageId,
    );

    if (ability.cannot(CaslAction.Read, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageHistoryService.findHistoryByPageId(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/history/info')
  async getPageHistoryInfo(
    @Body() dto: PageHistoryIdDto,
    @AuthUser() user: User,
  ) {
    const history = await this.pageHistoryService.findById(dto.historyId);
    if (!history) {
      throw new NotFoundException('Page history not found');
    }

    const ability = await this.permissionAbility.createForUserPage(
      user,
      history.pageId,
    );

    if (ability.cannot(CaslAction.Read, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    return history;
  }

  @HttpCode(HttpStatus.OK)
  @Post('/sidebar-pages')
  async getSidebarPages(
    @Body() dto: SidebarPageDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const ability = await this.permissionAbility.createForUserSpace(
      user,
      dto.spaceId,
    );

    if (ability.cannot(CaslAction.Read, CaslObject.Space)) {
      throw new ForbiddenException();
    }

    let pageId = null;
    if (dto.pageId) {
      const page = await this.pageRepo.findById(dto.pageId);
      if (page.spaceId !== dto.spaceId) {
        throw new ForbiddenException();
      }
      pageId = page.id;
    }

    const pagesInSpace = await this.pageService.getSidebarPages(
      dto.spaceId,
      pagination,
      pageId,
    );

    if (!pagesInSpace) {
      return;
    }

    return {
      items: await Promise.all(
        pagesInSpace.items.map(async (page: { id: string }) => {
          try {
            const pageAbility = await this.permissionAbility.createForUserPage(
              user,
              page.id,
            );
            return pageAbility.can(CaslAction.Read, CaslObject.Page)
              ? page
              : null;
          } catch (err) {
            return null;
          }
        }),
      ).then((items) => items.filter(Boolean)),
      meta: pagesInSpace.meta,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('move')
  async movePage(@Body() dto: MovePageDto, @AuthUser() user: User) {
    const movedPage = await this.pageRepo.findById(dto.pageId);
    if (!movedPage) {
      throw new NotFoundException('Moved page not found');
    }

    const ability = await this.permissionAbility.createForUserSpace(
      user,
      movedPage.spaceId,
    );

    if (ability.cannot(CaslAction.Edit, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageService.movePage(dto, movedPage);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/breadcrumbs')
  async getPageBreadcrumbs(@Body() dto: PageIdDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.permissionAbility.createForUserPage(
      user,
      dto.pageId,
    );

    if (ability.cannot(CaslAction.Read, CaslObject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageService.getPageBreadCrumbs(page.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  async removeSpaceMember(
    @Body() dto: RemovePageMemberDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateUserGroupIds(dto);

    const ability = await this.permissionAbility.createForUserPage(
      user,
      dto.pageId,
    );

    if (ability.cannot(CaslAction.Manage, CaslObject.Members)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.removeMemberFromPage(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/change-role')
  async updateSpaceMemberRole(
    @Body() dto: UpdatePageMemberRoleDto,
    @AuthUser() user: User,
  ) {
    this.validateUserGroupIds(dto);

    const ability = await this.permissionAbility.createForUserPage(
      user,
      dto.pageId,
    );

    if (ability.cannot(CaslAction.Manage, CaslObject.Members)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.updateSpaceMemberRole(dto);
  }

  private validateUserGroupIds(
    dto: RemovePageMemberDto | UpdatePageMemberRoleDto,
  ) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }
    if (dto.userId && dto.groupId) {
      throw new BadRequestException(
        'please provide either a userId or groupId and both',
      );
    }
  }
}
