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
  Delete,
} from '@nestjs/common';
import { PageService } from './services/page.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto, MovePageToSpaceDto } from './dto/move-page.dto';
import { PageHistoryIdDto, PageIdDto, PageInfoDto } from './dto/page.dto';
import { PageHistoryService } from './services/page-history.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { SidebarPageDto } from './dto/sidebar-page.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { RecentPageDto } from './dto/recent-page.dto';
import { AddPageMembersDto } from './dto/add-page-member.dto';
import { PageMemberService } from './services/page-member.service';
import { RemovePageMemberDto } from './dto/remove-page-member.dto';
import { UpdatePageMemberRoleDto } from './dto/update-page-member-role.dto';
import { PermissionAbilityFactory } from '../casl/abilities/permission-ability.factory';
import {
  PageCaslAction,
  PageCaslObject,
  SpaceCaslAction,
  SpaceCaslObject,
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
      includeContributors: true,
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageAbility = await this.permissionAbility.createForUserPage(
      user,
      page.id,
    );

    if (pageAbility.cannot(PageCaslAction.Read, PageCaslObject.Content)) {
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

    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslObject.Page)) {
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

    if (pageAbility.cannot(PageCaslAction.Edit, PageCaslObject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageService.update(page, updatePageDto, user.id);
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

    if (ability.cannot(PageCaslAction.Delete, PageCaslObject.Page)) {
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

    if (ability.cannot(PageCaslAction.Manage, PageCaslObject.Permission)) {
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

    if (ability.cannot(PageCaslAction.Manage, PageCaslObject.Permission)) {
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
          const ability = await this.permissionAbility.createForUserPage(
            user,
            page.id,
          );
          return ability.can(PageCaslAction.Read, PageCaslObject.Content)
            ? page
            : null;
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

    if (ability.cannot(PageCaslAction.Read, PageCaslObject.Content)) {
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

    if (ability.cannot(PageCaslAction.Read, PageCaslObject.Page)) {
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

    if (ability.cannot(SpaceCaslAction.View, SpaceCaslObject.Space)) {
      throw new ForbiddenException();
    }

    let pageId = null;
    if (dto.pageId) {
      const page = await this.pageRepo.findById(dto.pageId);
      if (page.spaceId !== dto.spaceId) {
        throw new BadRequestException('Page does not belong to the space');
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
          const pageAbility = await this.permissionAbility.createForUserPage(
            user,
            page.id,
          );
          return pageAbility.can(PageCaslAction.Read, PageCaslObject.Content)
            ? page
            : null;
        }),
      ).then((items) => items.filter(Boolean)),
      meta: pagesInSpace.meta,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('move-to-space')
  async movePageToSpace(
    @Body() dto: MovePageToSpaceDto,
    @AuthUser() user: User,
  ) {
    const movedPage = await this.pageRepo.findById(dto.pageId);
    if (!movedPage) {
      throw new NotFoundException('Page to move not found');
    }
    if (movedPage.spaceId === dto.spaceId) {
      throw new BadRequestException('Page is already in this space');
    }

    const abilities = await Promise.all([
      this.spaceAbility.createForUser(user, movedPage.spaceId),
      this.spaceAbility.createForUser(user, dto.spaceId),
    ]);

    if (
      abilities.some((ability) =>
        ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page),
      )
    ) {
      throw new ForbiddenException();
    }

    return this.pageService.movePageToSpace(movedPage, dto.spaceId);
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

    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslObject.Page)) {
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

    if (ability.cannot(PageCaslAction.Read, PageCaslObject.Content)) {
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

    if (ability.cannot(PageCaslAction.Manage, PageCaslObject.Permission)) {
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

    if (ability.cannot(PageCaslAction.Manage, PageCaslObject.Permission)) {
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
