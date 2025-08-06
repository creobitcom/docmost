import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { Page, UpdatablePage } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  executeWithPagination,
  PaginationResult,
} from '@docmost/db/pagination/pagination';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { MovePageDto } from '../dto/move-page.dto';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { generateSlugId } from '../../../common/helpers';
import { calculateBlockHash, executeTx } from '@docmost/db/utils';
import { PageMemberRepo } from '@docmost/db/repos/page/page-member.repo';
import { SpaceRole } from 'src/common/helpers/types/permission';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { SidebarPageDto, SidebarPageResultDto } from '../dto/sidebar-page.dto';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';
import { MyPageColorDto } from '../dto/update-color.dto';
import { PageBlocksService } from './page-blocks.service';
// import { CopyPageDto } from '../dto/copy-page.dto';

@Injectable()
export class PageService {
  private readonly logger: Logger;

  constructor(
    private pageRepo: PageRepo,
    private pageMemberRepo: PageMemberRepo,
    private attachmentRepo: AttachmentRepo,
    private readonly syncPageRepo: SynchronizedPageRepo,
    private readonly PageBlocksService: PageBlocksService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {
    this.logger = new Logger('PageService');
  }

  async findById(
    pageId: string,
    includeContent?: boolean,
    includeYdoc?: boolean,
    includeSpace?: boolean,
  ): Promise<Page> {
    return this.pageRepo.findById(pageId, {
      includeContent,
      includeYdoc,
      includeSpace,
    });
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
  ): Promise<Page> {
    let parentPageId = undefined;

    // check if parent page exists
    if (createPageDto.parentPageId) {
      const parentPage = await this.pageRepo.findById(
        createPageDto.parentPageId,
      );

      if (!parentPage || parentPage.spaceId !== createPageDto.spaceId) {
        throw new NotFoundException('Parent page not found');
      }

      parentPageId = parentPage.id;
    }
    const createdPage = await executeTx<Page>(this.db, async (trx) => {
      const createdpage = await this.pageRepo.insertPage(
        {
          slugId: generateSlugId(),
          title: createPageDto.title,
          position: await this.nextPagePosition(
            createPageDto.spaceId,
            parentPageId,
          ),
          icon: createPageDto.icon,
          parentPageId: parentPageId,
          spaceId: createPageDto.spaceId,
          creatorId: userId,
          workspaceId: workspaceId,
          lastUpdatedById: userId,
        },
        trx,
      );

      await this.pageMemberRepo.insertPageMember(
        {
          userId: userId,
          pageId: createdpage.id,
          role: SpaceRole.ADMIN,
          addedById: userId,
        },
        trx,
      );

      return createdpage;
    });

    return createdPage;
  }

  async nextPagePosition(spaceId: string, parentPageId?: string) {
    const lastPage = await this.pageRepo.findLastPage(spaceId, parentPageId);

    if (!lastPage) {
      return generateJitteredKeyBetween(null, null);
    } else {
      // if there is an existing page, we should get a position below it
      return generateJitteredKeyBetween(lastPage.position, null);
    }
  }

  async update(
    page: Page,
    updatePageDto: UpdatePageDto,
    userId: string,
  ): Promise<Page> {
    const contributors = new Set<string>(page.contributorIds ?? []);
    contributors.add(userId);
    await this.pageRepo.updatePageMetadata(
      {
        title: updatePageDto.title,
        icon: updatePageDto.icon,
        lastUpdatedById: userId,
        updatedAt: new Date(),
        contributorIds: Array.from(contributors),
      },
      page.id,
    );

    return await this.pageRepo.findById(page.id, {
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
      includeContributors: true,
    });
  }

  withHasChildren(eb: ExpressionBuilder<DB, 'pages'>) {
    return eb
      .selectFrom('pages as child')
      .select((eb) =>
        eb
          .case()
          .when(eb.fn.countAll(), '>', 0)
          .then(true)
          .else(false)
          .end()
          .as('count'),
      )
      .whereRef('child.parentPageId', '=', 'pages.id')
      .limit(1)
      .as('hasChildren');
  }

  async getPagesInSpace(
    spaceId: string,
    pagination?: PaginationOptions,
    trx?: KyselyTransaction,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    return this.pageRepo.getPagesInSpace(spaceId, pagination, trx);
  }

  async getSidebarPages(
    spaceId: string,
    pagination: PaginationOptions,
    pageId?: string,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    return this.pageRepo.getSidebarPages(spaceId, pagination, pageId);
  }

  async movePageToSpace(rootPage: Page, spaceId: string) {
    await executeTx(this.db, async (trx) => {
      // Update root page
      const nextPosition = await this.nextPagePosition(spaceId);
      await this.pageRepo.updatePageMetadata(
        {
          spaceId,
          parentPageId: null,
          position: nextPosition,
          content: rootPage.content,
        },
        rootPage.id,
        trx,
      );
      const pageIds = await this.pageRepo
        .getPageAndDescendants(rootPage.id)
        .then((pages) => pages.map((page) => page.id));
      // The first id is the root page id
      if (pageIds.length > 1) {
        // Update sub pages
        await this.updatePages(
          { spaceId },
          pageIds.filter((id) => id !== rootPage.id),
          trx,
        );
      }
      // Update attachments
      await this.attachmentRepo.updateAttachmentsByPageId(
        { spaceId },
        pageIds,
        trx,
      );
    });
  }

  async updatePages(
    updatePageData: UpdatablePage,
    pageIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    for (const pageId of pageIds) {
      await this.updatePageWithContent(updatePageData, pageId, trx);
    }
  }

  async updatePageWithContent(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    this.logger.debug('Updating page: ', updatePageData);

    const pageUpdateResult = await this.pageRepo.updatePageMetadata(
      updatePageData,
      pageId,
      trx,
    );

    if (updatePageData.content) {
      await this.updatePageBlocks(updatePageData, pageId, trx);
    }

    return pageUpdateResult;
  }

  async updatePageBlocks(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const blocks: {
      attrs: { blockId: string };
      type?: string;
      content?: any[];
    }[] = (updatePageData?.content as any)?.content;

    if (!blocks || blocks.length === 0) {
      return;
    }

    const existingBlocks = await this.pageRepo.getExistingPageBlocks(
      pageId,
      trx,
    );

    const existingBlocksMap = new Map(
      existingBlocks.map((block) => [block.id, block]),
    );

    const incomingBlockIds = new Set(
      blocks.map((block) => {
        if (!Object.prototype.hasOwnProperty.call(block, 'attrs')) {
          this.logger.error('Block missing blockId attribute: ', block);
          return null;
        }
        if (!Object.prototype.hasOwnProperty.call(block.attrs, 'blockId')) {
          this.logger.error('Block missing blockId attribute: ', block);
          return null;
        }
        return block.attrs.blockId;
      }),
    );
    this.logger.debug('Incoming blocks: ', incomingBlockIds);

    const removedBlocks = existingBlocks.filter(
      (existingBlock) => !incomingBlockIds.has(existingBlock.id),
    );

    this.logger.debug('Deleting blocks: ', removedBlocks);
    for (const removedBlock of removedBlocks) {
      await this.pageRepo.deleteBlock(removedBlock.id, trx);
    }

    for (const block of blocks) {
      const blockId = block.attrs.blockId;
      const existingBlock = existingBlocksMap.get(blockId);
      const calculatedHash = calculateBlockHash(block);

      if (!existingBlock) {
        await this.pageRepo.createBlock(
          block,
          blockId,
          pageId,
          calculatedHash,
          trx,
        );
      } else if (existingBlock.stateHash !== calculatedHash) {
        await this.pageRepo.updateExistingBlock(
          block,
          blockId,
          calculatedHash,
          trx,
        );
      }
    }
  }

  async movePage(dto: MovePageDto, movedPage: Page) {
    // validate position value by attempting to generate a key
    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch (err) {
      throw new BadRequestException('Invalid move position');
    }

    let parentPageId = null;
    if (movedPage.parentPageId === dto.parentPageId) {
      parentPageId = undefined;
    } else {
      // changing the page's parent
      if (dto.parentPageId) {
        const parentPage = await this.pageRepo.findById(dto.parentPageId);
        if (!parentPage || parentPage.spaceId !== movedPage.spaceId) {
          throw new NotFoundException('Parent page not found');
        }
        parentPageId = parentPage.id;
      }
    }

    await this.pageRepo.updatePageMetadata(
      {
        position: dto.position,
        parentPageId: parentPageId,
      },
      dto.pageId,
    );
  }

  async moveMyPage(
    dto: MovePageDto,
    movedPage: Page,
    userId: string,
  ): Promise<void> {
    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch (err) {
      throw new BadRequestException('Invalid move position');
    }

    // TODO: проверка прав
    if (dto.parentPageId) {
      const parentPage = await this.pageRepo.findById(dto.parentPageId);
      if (!parentPage) {
        throw new NotFoundException('Parent page not found');
      }

      if (parentPage.spaceId !== movedPage.spaceId) {
        throw new BadRequestException('Parent page must be in the same space');
      }

      // if (parentPage.spaceId !== dto.personalSpaceId) {
      //   throw new BadRequestException();
      // }
    }

    // if (movedPage.spaceId !== dto.personalSpaceId && movedPage.parentPageId) {
    //   throw new BadRequestException();
    // }

    return this.pageRepo.updateUserPagePreferences({
      position: dto.position,
      pageId: dto.pageId,
      userId: userId,
    });
  }

  async getPageBreadCrumbs(childPageId: string): Promise<Partial<Page>[]> {
    return this.pageRepo.getPageBreadCrumbs(childPageId);
  }

  async getRecentSpacePages(
    spaceId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Page>> {
    return await this.pageRepo.getRecentPagesInSpace(spaceId, pagination);
  }

  async getRecentPages(
    userId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Page>> {
    return await this.pageRepo.getRecentPages(userId, pagination);
  }

  async forceDelete(pageId: string): Promise<void> {
    const refPages = await this.syncPageRepo.findAllRefsByOriginId(pageId);

    await executeTx(this.db, async (trx) => {
      if (refPages.length > 0) {
        for (const refPage of refPages) {
          await this.pageRepo.deletePage(refPage.referencePageId, trx);
        }
      }

      await this.pageRepo.deletePage(pageId, trx);
    });
  }

  async getMyPages(
    pageId?: string,
    pagination?: PaginationOptions,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    const baseQuery = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'position',
        'parentPageId',
        'spaceId',
        'creatorId',
        'isSynced',
      ])
      .select((eb) => this.withHasChildren(eb))
      .orderBy('position', 'asc');

    const query = baseQuery.where(
      'parentPageId',
      pageId ? '=' : 'is',
      pageId ?? null,
    );

    const result: PaginationResult<SidebarPageResultDto> =
      await executeWithPagination(query, {
        page: pagination?.page || 1,
        perPage: 250,
      });

    return result;
  }

  async updateMyPageColor(dto: MyPageColorDto, userId: string) {
    const preferences = await this.pageRepo.findUserPagePreferences(
      dto.pageId,
      userId,
    );

    if (!preferences) {
      return this.pageRepo.createUserPagePreferences({
        userId: userId,
        pageId: dto.pageId,
        color: dto.color,
      });
    }

    return this.pageRepo.updateUserPagePreferences({
      pageId: dto.pageId,
      userId,
      color: dto.color,
    });
  }

  async updateForSocket(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    this.logger.debug('Updating page: ', updatePageData);

    const pageUpdateResult = await this.pageRepo.updatePageMetadata(
      updatePageData,
      pageId,
      trx,
    );

    if (updatePageData.content) {
      await this.updatePageBlocks(updatePageData, pageId, trx);
    }

    return pageUpdateResult;
  }

  // async copyPage(
  //   copyPageDto: CopyPageDto,
  //   userId: string,
  //   workspaceId: string,
  // ) {
  //   const { parentPageId, originPageId, spaceId } = copyPageDto;
  //   // Implementation commented out - feature removed
  //   throw new BadRequestException('Copy page feature is not available');
  // }

  // Проверяет, есть ли у пользователя прямой доступ к странице
  async userHasDirectPageAccess(userId: string, pageId: string): Promise<boolean> {
    try {
      const page = await this.pageRepo.findById(pageId);
      if (!page) return false;

      // Проверяем, является ли пользователь создателем страницы
      if (page.creatorId === userId) return true;

      // Проверяем права через PageMemberRepo
      const pageMember = await this.pageMemberRepo.findPageMember(pageId, userId);
      return !!pageMember;
    } catch (error) {
      this.logger.error(`Error checking page access for user ${userId} on page ${pageId}:`, error);
      return false;
    }
  }

  // Получает блоки страницы с правами доступа пользователя
  async getPageBlocksWithPermissions(pageId: string, userId: string): Promise<any[]> {
    try {
      // Получаем все блоки страницы
      const blocks = await this.PageBlocksService.getPageBlocks(pageId);

      // Проверяем, является ли пользователь создателем страницы
      const page = await this.pageRepo.findById(pageId);
      const isPageCreator = page?.creatorId === userId;

      // Получаем права доступа пользователя к блокам
      const accessibleBlocks = await this.PageBlocksService.getAccessiblePageBlocks(pageId, userId);
      const accessibleBlockIds = new Set(accessibleBlocks.map(b => b.id));

      // Формируем результат с правами доступа
      const blocksWithPermissions = await Promise.all(blocks.map(async (block) => {
        const hasAccess = accessibleBlockIds.has(block.id);
        let userPermission: string | null = null;

        if (hasAccess) {
          // Если пользователь является создателем страницы, даем ему права owner
          if (isPageCreator) {
            return {
              ...block,
              hasAccess: true,
              userPermission: "owner"
            };
          }

          // Определяем права пользователя
          // Проверяем права через block_permissions
          const userPermissionResult = await this.db
            .selectFrom('block_permissions')
            .select(['role'])
            .where('blockId', '=', block.id)
            .where('userId', '=', userId)
            .executeTakeFirst();

          if (userPermissionResult) {
            return {
              ...block,
              hasAccess,
              userPermission: userPermissionResult.role
            };
          } else {
            return {
              ...block,
              hasAccess,
              userPermission: "read" // По умолчанию
            };
          }
        }

        return {
          ...block,
          hasAccess,
          userPermission
        };
      }));

      return blocksWithPermissions;
    } catch (error) {
      this.logger.error(`Error getting page blocks with permissions for user ${userId} on page ${pageId}:`, error);
      return [];
    }
  }

  // Обновляет блоки страницы (новая версия для API)
  async updatePageBlocksViaApi(pageId: string, blocks: any[], userId: string): Promise<any[]> {
    try {
      // Проверяем права доступа
      const hasAccess = await this.userHasDirectPageAccess(userId, pageId);
      if (!hasAccess) {
        throw new Error('No access to update page blocks');
      }

      // Обновляем каждый блок
      const updatedBlocks = [];
      for (const block of blocks) {
        const updatedBlock = await this.PageBlocksService.updateBlock(block.id, {
          content: block.content,
          position: block.position
        });
        updatedBlocks.push(updatedBlock);
      }

      return updatedBlocks;
    } catch (error) {
      this.logger.error(`Error updating page blocks for user ${userId} on page ${pageId}:`, error);
      throw error;
    }
  }

  // Мигрирует страницу со старой архитектуры в блок-ориентированную
  async migratePageToBlocks(pageId: string, userId: string): Promise<any> {
    try {
      // Проверяем права доступа
      const hasAccess = await this.userHasDirectPageAccess(userId, pageId);
      if (!hasAccess) {
        throw new Error('No access to migrate page');
      }

      // Получаем страницу
      const page = await this.pageRepo.findById(pageId, { includeContent: true });
      if (!page) {
        throw new Error('Page not found');
      }

      // Проверяем, есть ли уже блоки
      const existingBlocks = await this.PageBlocksService.getPageBlocks(pageId);
      if (existingBlocks.length > 0) {
        return { message: 'Page already migrated to blocks', blocks: existingBlocks };
      }

      // Создаем блок из старого контента
      let blockContent = null;
      if (page.content) {
        try {
          // Если контент в JSON формате, используем его
          if (typeof page.content === 'object') {
            blockContent = page.content;
          } else if (typeof page.content === 'string') {
            blockContent = JSON.parse(page.content);
          }
        } catch (error) {
          // Если не удалось распарсить, создаем простой параграф
          blockContent = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: page.content || "" }]
              }
            ]
          };
        }
      }

      // Создаем блок
      const newBlock = await this.PageBlocksService.createBlock(pageId, {
        pageId: pageId,
        blockType: 'paragraph',
        position: 0,
        content: blockContent
      }, userId);

      return {
        message: 'Page successfully migrated to blocks',
        blocks: [newBlock]
      };
    } catch (error) {
      this.logger.error(`Error migrating page ${pageId} to blocks:`, error);
      throw error;
    }
  }
}

/*
  // TODO: page deletion and restoration
  async delete(pageId: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const page = await manager
        .createQueryBuilder(Page, 'page')
        .where('page.id = :pageId', { pageId })
        .select(['page.id', 'page.workspaceId'])
        .getOne();

      if (!page) {
        throw new NotFoundException(`Page not found`);
      }
      await this.softDeleteChildrenRecursive(page.id, manager);
      await this.pageOrderingService.removePageFromHierarchy(page, manager);

      await manager.softDelete(Page, pageId);
    });
  }

  private async softDeleteChildrenRecursive(
    parentId: string,
    manager: EntityManager,
  ): Promise<void> {
    const childrenPage = await manager
      .createQueryBuilder(Page, 'page')
      .where('page.parentPageId = :parentId', { parentId })
      .select(['page.id', 'page.title', 'page.parentPageId'])
      .getMany();

    for (const child of childrenPage) {
      await this.softDeleteChildrenRecursive(child.id, manager);
      await manager.softDelete(Page, child.id);
    }
  }

  async restore(pageId: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const isDeleted = await manager
        .createQueryBuilder(Page, 'page')
        .where('page.id = :pageId', { pageId })
        .withDeleted()
        .getCount();

      if (!isDeleted) {
        return;
      }

      await manager.recover(Page, { id: pageId });

      await this.restoreChildrenRecursive(pageId, manager);

      // Fetch the page details to find out its parent and workspace
      const restoredPage = await manager
        .createQueryBuilder(Page, 'page')
        .where('page.id = :pageId', { pageId })
        .select(['page.id', 'page.title', 'page.spaceId', 'page.parentPageId'])
        .getOne();

      if (!restoredPage) {
        throw new NotFoundException(`Restored page not found.`);
      }

      // add page back to its hierarchy
      await this.pageOrderingService.addPageToOrder(
        restoredPage.spaceId,
        pageId,
        restoredPage.parentPageId,
      );
    });
  }

  private async restoreChildrenRecursive(
    parentId: string,
    manager: EntityManager,
  ): Promise<void> {
    const childrenPage = await manager
      .createQueryBuilder(Page, 'page')
      .setLock('pessimistic_write')
      .where('page.parentPageId = :parentId', { parentId })
      .select(['page.id', 'page.title', 'page.parentPageId'])
      .withDeleted()
      .getMany();

    for (const child of childrenPage) {
      await this.restoreChildrenRecursive(child.id, manager);
      await manager.recover(Page, { id: child.id });
    }
  }
*/
