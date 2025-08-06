import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
  Query,
  Param,
  Put,
  Inject,
  Req,
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
import { SpaceMember, User, Workspace } from '@docmost/db/types/entity.types';
import { SidebarPageDto } from './dto/sidebar-page.dto';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { RecentPageDto } from './dto/recent-page.dto';
import PageAbilityFactory from '../casl/abilities/page-ability.factory';
import {
  PageCaslAction,
  PageCaslSubject,
} from '../casl/interfaces/page-ability.type';
import { AddPageMembersDto } from './dto/add-page-member.dto';
import { PageMemberService } from './services/page-member.service';
import { PageMemberRepo } from '@docmost/db/repos/page/page-member.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { RemovePageMemberDto } from './dto/remove-page-member.dto';
import { UpdatePageMemberRoleDto } from './dto/update-page-member-role.dto';
import { CreateSyncPageDto } from './dto/create-sync-page.dto';
import { SynchronizedPageService } from './services/synchronized-page.service';
import { SpaceIdDto } from '../space/dto/space-id.dto';
import { MyPageColorDto } from './dto/update-color.dto';
import { MyPagesDto } from './dto/my-pages.dto';
import { CopyPageDto } from './dto/copy-page.dto';
import { SpaceRole } from 'src/common/helpers/types/permission';
import { BlockPermissionService } from './services/block-permission.service';
import { PageBlocksService } from './services/page-blocks.service';
import { UpdatePageBlocksDto } from './dto/update-page-block.dto';
import { extractTopLevelBlocks } from './extract-page-blocks';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import * as fs from 'fs';
import * as path from 'path';

// Функция для логирования в файл
function logToFile(message: string) {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'page-controller.log');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message); // Также выводим в консоль
}

interface Request {
  user: { id: string, user: { id: string } };
}

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageController {
  constructor(
    private readonly pageBlocksService: PageBlocksService,
    private readonly pageService: PageService,
    private readonly pageMemberService: PageMemberService,
    private readonly pageMemberRepo: PageMemberRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageHistoryService: PageHistoryService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAbility: PageAbilityFactory,
    private readonly syncPageService: SynchronizedPageService,
    private readonly blockPermissionService: BlockPermissionService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('blocks/:pageId')
  @SkipTransform()
  async updateBlocksForPage(
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageBlocksDto,
    @AuthUser() user: User,
  ) {
    console.log('updateBlocksForPage pageId:', pageId, 'body:', dto);

    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageAbility = await this.pageAbility.createForUser(user, pageId);
    if (pageAbility.cannot(PageCaslAction.Edit, PageCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    await this.pageBlocksService.saveBlocksForPage(pageId, dto.blocks, user.id);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Get('blockPermissions/:pageId/:blockId')
  async getBlockPermissions(
    @Param('pageId') pageId: string,
    @Param('blockId') blockId: string,
    @AuthUser() user: User,
  ) {
    console.log('[getBlockPermissions] Starting with pageId:', pageId, 'blockId:', blockId, 'user.id:', user.id);

    // Получаем информацию о странице
    const page = await this.db
      .selectFrom('pages')
      .select(['creatorId', 'spaceId'])
      .where('id', '=', pageId)
      .executeTakeFirst() as any;

    console.log('[getBlockPermissions] Raw page result:', page);

    if (!page) {
      console.error('[getBlockPermissions] Page not found for id:', pageId);
      throw new NotFoundException('Page not found');
    }

    const isCreator = String(page.creatorId) === String(user.id);

    // Проверяем роль пользователя в таблице users
    const userRole = await this.db
      .selectFrom('users')
      .select(['role'])
      .where('id', '=', user.id)
      .executeTakeFirst();

    // Проверяем роль пользователя в таблице spaceMembers
    const spaceMemberRole = page?.spaceId ? await this.db
      .selectFrom('spaceMembers')
      .select(['role'])
      .where('userId', '=', user.id)
      .where('spaceId', '=', page.spaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst() : null;

    // Пользователь имеет права owner если:
    // 1. Он создатель страницы
    // 2. У него роль 'owner' в таблице users
    // 3. У него роль 'admin' или 'owner' в таблице spaceMembers
    const hasOwnerRights = isCreator || 
      userRole?.role === 'owner' || 
      spaceMemberRole?.role === 'admin' || 
      spaceMemberRole?.role === 'owner';

    console.log('[getBlockPermissions] User role check:', {
      userId: user.id,
      userRole: userRole?.role,
      spaceMemberRole: spaceMemberRole?.role,
      hasOwnerRights,
      isCreator
    });

    // Если пользователь не имеет прав owner, проверяем его права на блок
    if (!hasOwnerRights) {
      const blockPermission = await this.db
        .selectFrom('block_permissions')
        .select('permission')
        .where('pageId', '=', pageId)
        .where('blockId', '=', blockId)
        .where('userId', '=', user.id)
        .executeTakeFirst();

      // Если у пользователя нет прав 'owner', запрещаем доступ
      if (!blockPermission || blockPermission.permission !== 'owner') {
        throw new ForbiddenException('Insufficient permissions to view block permissions');
      }
    }

    const permissions = await this.db
      .selectFrom('block_permissions')
      .innerJoin('users', 'users.id', 'block_permissions.userId')
      .select((eb) => [
        'users.id',
        'users.name',
        eb.ref('users.avatarUrl').as('avatarUrl'),
        'block_permissions.permission',
      ])
      .where('block_permissions.pageId', '=', pageId)
      .where('block_permissions.blockId', '=', blockId)
      .execute();

    return permissions;
  }

  @HttpCode(HttpStatus.OK)
  @Get(':pageId/blockPermissions')
  async getAccessibleBlocks(
    @Param('pageId') pageId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      console.warn('[BlockPermissions] userId is missing in query!');
      throw new BadRequestException('userId is required');
    }

    return this.blockPermissionService.getAccessiblePageBlocks(pageId, userId);
  }

  @Get('/:pageId/blocks')
  async getPageBlocks(@Param('pageId') pageId: string, @AuthUser() user: User) {
    try {
      console.log('[getPageBlocks] Request for pageId:', pageId, 'user:', user.id);
      
      // Проверяем права доступа к странице
      const hasPageAccess = await this.pageService.userHasDirectPageAccess(user.id, pageId);
      if (!hasPageAccess) {
        throw new ForbiddenException('No access to this page');
      }

      // Получаем блоки страницы с правами доступа
      const blocks = await this.pageService.getPageBlocksWithPermissions(pageId, user.id);
      
      console.log('[getPageBlocks] Returning blocks:', blocks.length);
      return blocks;
    } catch (error) {
      console.error('[getPageBlocks] Error:', error);
      throw error;
    }
  }

  @Put('/:pageId/blocks')
  async updatePageBlocks(
    @Param('pageId') pageId: string, 
    @Body() body: { blocks: any[] },
    @AuthUser() user: User
  ) {
    try {
      console.log('[updatePageBlocks] Request for pageId:', pageId, 'blocks count:', body.blocks?.length);
      
      // Проверяем права доступа к странице
      const hasPageAccess = await this.pageService.userHasDirectPageAccess(user.id, pageId);
      if (!hasPageAccess) {
        throw new ForbiddenException('No access to this page');
      }

      // Обновляем блоки
      const updatedBlocks = await this.pageService.updatePageBlocksViaApi(pageId, body.blocks, user.id);
      
      console.log('[updatePageBlocks] Updated blocks:', updatedBlocks.length);
      return updatedBlocks;
    } catch (error) {
      console.error('[updatePageBlocks] Error:', error);
      throw error;
    }
  }

  @Post('/:pageId/migrate-to-blocks')
  async migrateToBlocks(@Param('pageId') pageId: string, @Body() body: any, @AuthUser() user: User) {
    try {
      console.log('[migrateToBlocks] Starting migration for pageId:', pageId, 'user:', user.id);
      
      // Проверяем права доступа к странице
      const hasPageAccess = await this.pageService.userHasDirectPageAccess(user.id, pageId);
      if (!hasPageAccess) {
        throw new ForbiddenException('No access to this page');
      }

      // Выполняем миграцию
      const migrationResult = await this.pageService.migratePageToBlocks(pageId, user.id);
      
      console.log('[migrateToBlocks] Migration completed:', migrationResult);
      return migrationResult;
    } catch (error) {
      console.error('[migrateToBlocks] Error:', error);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('blockPermissions')
  async assignPermissionToBlock(
    @Body() dto: {
      pageId: string;
      blockId: string;
      userId: string;
      role?: string;
      permission?: string;
    },
    @AuthUser() user: User,
  ) {
    const { pageId, blockId, userId, role = 'reader', permission = 'read' } = dto;

    // Запрещаем пользователю изменять свои собственные права
    if (userId === user.id) {
      throw new ForbiddenException('Users cannot modify their own permissions');
    }

    // Получаем информацию о странице
    const page = await this.db
      .selectFrom('pages')
      .select(['creatorId', 'spaceId'])
      .where('id', '=', pageId)
      .executeTakeFirst() as any;

    const isCreator = String(page?.creatorId) === String(user.id);

    // Проверяем роль пользователя в таблице users
    const userRole = await this.db
      .selectFrom('users')
      .select(['role'])
      .where('id', '=', user.id)
      .executeTakeFirst();

    // Проверяем роль пользователя в таблице spaceMembers
    const spaceMemberRole = page?.spaceId ? await this.db
      .selectFrom('spaceMembers')
      .select(['role'])
      .where('userId', '=', user.id)
      .where('spaceId', '=', page.spaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst() : null;

    // Пользователь имеет права owner если:
    // 1. Он создатель страницы
    // 2. У него роль 'owner' в таблице users
    // 3. У него роль 'admin' или 'owner' в таблице spaceMembers
    const hasOwnerRights = isCreator || 
      userRole?.role === 'owner' || 
      spaceMemberRole?.role === 'admin' || 
      spaceMemberRole?.role === 'owner';

    // Если пользователь не имеет прав owner, проверяем его права на блок
    if (!hasOwnerRights) {
      const blockPermission = await this.db
        .selectFrom('block_permissions')
        .select('permission')
        .where('pageId', '=', pageId)
        .where('blockId', '=', blockId)
        .where('userId', '=', user.id)
        .executeTakeFirst();

      // Если у пользователя нет прав 'owner', запрещаем доступ
      if (!blockPermission || blockPermission.permission !== 'owner') {
        throw new ForbiddenException('Insufficient permissions to modify block permissions');
      }
    }

    // check: does block exist on current page
    const block = await this.db
      .selectFrom('blocks')
      .select(['id'])
      .where('pageId', '=', pageId)
      .where('id', '=', blockId)
      .executeTakeFirst();

    if (!block) {
      throw new NotFoundException('Block not found for given page and blockId');
    }

    // Cascade permission save
    await this.blockPermissionService.updateBlockPermission({
      pageId,
      blockId,
      userId,
      role,
      permission: permission as 'read' | 'edit' | 'owner',
    });

    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Delete('blockPermissions')
  async deleteBlockPermission(
    @Body() dto: { pageId: string; blockId: string; userId: string },
    @AuthUser() user: User,
  ) {
    // Запрещаем пользователю удалять свои собственные права
    if (dto.userId === user.id) {
      throw new ForbiddenException('Users cannot delete their own permissions');
    }

    // Получаем информацию о странице
    const page = await this.db
      .selectFrom('pages')
      .select(['creatorId', 'spaceId'])
      .where('id', '=', dto.pageId)
      .executeTakeFirst() as any;

    const isCreator = String(page?.creatorId) === String(user.id);

    // Проверяем роль пользователя в таблице users
    const userRole = await this.db
      .selectFrom('users')
      .select(['role'])
      .where('id', '=', user.id)
      .executeTakeFirst();

    // Проверяем роль пользователя в таблице spaceMembers
    const spaceMemberRole = page?.spaceId ? await this.db
      .selectFrom('spaceMembers')
      .select(['role'])
      .where('userId', '=', user.id)
      .where('spaceId', '=', page.spaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst() : null;

    // Пользователь имеет права owner если:
    // 1. Он создатель страницы
    // 2. У него роль 'owner' в таблице users
    // 3. У него роль 'admin' или 'owner' в таблице spaceMembers
    const hasOwnerRights = isCreator || 
      userRole?.role === 'owner' || 
      spaceMemberRole?.role === 'admin' || 
      spaceMemberRole?.role === 'owner';

    // Если пользователь не имеет прав owner, проверяем его права на блок
    if (!hasOwnerRights) {
      const blockPermission = await this.db
        .selectFrom('block_permissions')
        .select('permission')
        .where('pageId', '=', dto.pageId)
        .where('blockId', '=', dto.blockId)
        .where('userId', '=', user.id)
        .executeTakeFirst();

      // Если у пользователя нет прав 'owner', запрещаем доступ
      if (!blockPermission || blockPermission.permission !== 'owner') {
        throw new ForbiddenException('Insufficient permissions to delete block permissions');
      }
    }

    return this.blockPermissionService.deleteBlockPermission(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getPage(@Body() dto: PageInfoDto, @AuthUser() user: User): Promise<any> {
    logToFile(`[PageController] getPage called with dto: ${JSON.stringify(dto)} user: ${user.id}`);
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

    const pageAbility = await this.pageAbility.createForUser(user, page.id);

    if (pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const userPageRoles = await this.pageMemberRepo.getUserPageRoles(
      user.id,
      page.id,
    );

    const userPageRole = findHighestUserSpaceRole(userPageRoles);

    const membership = {
      userId: user.id,
      role: userPageRole,
      permissions: pageAbility.rules,
    };
    let blocks = await this.blockPermissionService.getAccessiblePageBlocks(page.id, user.id);

      const syncPage = await this.syncPageService.findByReferenceId(page.id);

    if (syncPage) {
      const originPage = await this.pageRepo.findById(syncPage.originPageId, {
        includeContent: true,
        includeLastUpdatedBy: true,
        includeContributors: true,
      });
      if (!originPage) {
        throw new NotFoundException('Origin page not found');
      }
      page.content = originPage.content;
      page.id = originPage.id;
      page.title = originPage.title;
      page.icon = originPage.icon;
    }

    // FALLBACK: If no blocks exist but page has content, create blocks from content
    if (blocks.length === 0 && page.content) {
      logToFile(`[PageController] No blocks found, creating from page content for page: ${page.id}`);
      try {
        const blocksFromContent = extractTopLevelBlocks(page.content, page.id);
        if (blocksFromContent.length > 0) {
          await this.pageBlocksService.saveBlocksForPage(page.id, blocksFromContent, user.id);
          // Reload blocks after creation
          blocks = await this.blockPermissionService.getAccessiblePageBlocks(page.id, user.id);
          logToFile(`[PageController] Created and loaded blocks: ${blocks.length}`);
        }
      } catch (error) {
        logToFile(`[PageController] Error creating blocks from content: ${error}`);
      }
    }

    // For backward compatibility with frontend that expects page.content
    // Return blocks separately instead of combining them into one document
    let compatibilityContent = null;
    if (blocks.length > 0) {
      // Return the first block's content for backward compatibility, but keep blocks separate
      compatibilityContent = blocks[0]?.content || null;
      logToFile(`[PageController] Returning ${blocks.length} separate blocks`);
    } else {
      logToFile(`[PageController] No blocks found, using original page.content`);
      compatibilityContent = page.content;
    }

    return { 
      ...page, 
      content: compatibilityContent,
      blocks, 
      membership 
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() createPageDto: CreatePageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      createPageDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
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

    const pageAbility = await this.pageAbility.createForUser(
      user,
      updatePageDto.pageId,
    );

    if (pageAbility.cannot(PageCaslAction.Edit, PageCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    Logger.debug(updatePageDto);
    const updatedPage = await this.pageService.update(
      page,
      updatePageDto,
      user.id,
    );

    // Block extraction will be handled in page service if content is provided
    // if (updatePageDto.content) {
    //   const blocks = extractTopLevelBlocks(updatePageDto.content, updatePageDto.pageId);
    //   await this.pageBlocksService.saveBlocksForPage(updatePageDto.pageId, blocks, user.id);
    // }

    if (page.isSynced) {
      const syncPageData = await this.syncPageService.findByReferenceId(
        page.id,
      );
      const originPage = await this.pageRepo.findById(
        syncPageData.originPageId,
      );
      return this.pageService.update(originPage, updatePageDto, user.id);
    }

    return updatedPage;
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() pageIdDto: PageIdDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(pageIdDto.pageId);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageAbility = await this.pageAbility.createForUser(user, page.id);

    if (pageAbility.cannot(PageCaslAction.Delete, PageCaslSubject.Page)) {
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
    const ability = await this.pageAbility.createForUser(
      user,
      pageIdDto.pageId,
    );

    if (ability.cannot(PageCaslAction.Read, PageCaslSubject.Member)) {
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

    const ability = await this.pageAbility.createForUser(user, dto.pageId);
    if (ability.cannot(PageCaslAction.Manage, PageCaslSubject.Member)) {
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
            const pageAbility = await this.pageAbility.createForUser(
              user,
              page.id,
            );
            return pageAbility.can(PageCaslAction.Read, PageCaslSubject.Page)
              ? page
              : null;
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

    const pageAbility = await this.pageAbility.createForUser(user, page.id);

    if (pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)) {
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

    const pageAbility = await this.pageAbility.createForUser(
      user,
      history.pageId,
    );

    if (pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)) {
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
    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      dto.spaceId,
    );
    if (spaceAbility.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
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
        pagesInSpace.items.map(async (page) => {
          try {
            if (page.isSynced) {
              const syncPageMeta = await this.syncPageService.findByReferenceId(
                page.id,
              );
              const originPage = await this.pageRepo.findById(
                syncPageMeta.originPageId,
              );

              page.title = originPage.title;
              page.icon = originPage.icon;
            }

            const pageAbility = await this.pageAbility.createForUser(
              user,
              page.id,
            );
            return pageAbility.can(PageCaslAction.Read, PageCaslSubject.Page)
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

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      movedPage.spaceId,
    );

    if (spaceAbility.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    if (dto.isMyPages) {
      return this.pageService.moveMyPage(dto, movedPage, user.id);
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

    const pageAbility = await this.pageAbility.createForUser(user, page.id);
    if (pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)) {
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
    this.validateIds(dto);

    const ability = await this.pageAbility.createForUser(user, dto.pageId);
    if (ability.cannot(PageCaslAction.Manage, PageCaslSubject.Member)) {
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
    this.validateIds(dto);

    const ability = await this.pageAbility.createForUser(user, dto.pageId);
    if (ability.cannot(PageCaslAction.Manage, PageCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.updateSpaceMemberRole(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/sync-page')
  async createSyncPage(
    @Body() dto: CreateSyncPageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const originPage = await this.pageService.findById(dto.originPageId);
    if (!originPage) {
      throw new NotFoundException('Origin page not found');
    }

    if (dto.parentPageId && dto.parentPageId === originPage.parentPageId) {
      throw new BadRequestException(
        'Cannot create a sync page with the same parent page as the origin page',
      );
    }

    return this.syncPageService.create(dto, user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Get('/')
  async getSpacePages(
    @Query() dto: SpaceIdDto,
    @Query() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      dto.spaceId,
    );
    if (spaceAbility.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const pagesInSpace = await this.pageService.getPagesInSpace(
      dto.spaceId,
      pagination,
    );

    if (!pagesInSpace) {
      return;
    }

    return {
      items: await Promise.all(
        pagesInSpace.items.map(async (page) => {
          try {
            const pageAbility = await this.pageAbility.createForUser(
              user,
              page.id,
            );
            return pageAbility.can(PageCaslAction.Read, PageCaslSubject.Page)
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
  @Get('/my-pages')
  async myPages(
    @Query() dto: MyPagesDto,
    @Query() pagination: PaginationOptions,
  ) {
    return this.pageService.getMyPages(dto.pageId, pagination);
  }

  validateIds(dto: RemovePageMemberDto | UpdatePageMemberRoleDto) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }
    if (dto.userId && dto.groupId) {
      throw new BadRequestException(
        'please provide either a userId or groupId and both',
      );
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('/my-pages/color')
  async myPageColor(@Body() dto: MyPageColorDto, @AuthUser() user: User) {
    const page = await this.pageService.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const pageAbility = await this.pageAbility.createForUser(user, page.id);
    if (!pageAbility.can(PageCaslAction.Manage, PageCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    await this.pageService.updateMyPageColor(dto, user.id);
  }
}
