import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';


import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import {
  Page,
  PageContent,
  UpdatablePage,
} from '@docmost/db/types/entity.types';
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
import { SidebarPageResultDto } from '../dto/sidebar-page.dto';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';
import { MyPageColorDto } from '../dto/update-color.dto';
import { CopyPageDto } from '../dto/copy-page.dto';

@Injectable()
export class PageService {
  private readonly logger: Logger;

  constructor(
    private pageRepo: PageRepo,
    private pageMemberRepo: PageMemberRepo,
    private attachmentRepo: AttachmentRepo,
    private readonly syncPageRepo: SynchronizedPageRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {
    this.logger = new Logger('PageService');
  }

  async findById(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      includeYdoc?: boolean;
      includeSpace?: boolean;
    },
  ): Promise<Page> {
    return this.pageRepo.findById(pageId, {
      includeContent: opts?.includeContent,
      includeYdoc: opts?.includeYdoc,
      includeSpace: opts?.includeSpace,
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

    // Обновляем метаданные страницы через правильный метод
    await this.pageRepo.updatePage(
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

  async movePageToSpace(
    rootPage: Page,
    spaceId: string,
    parentPageId?: string,
  ) {
    await executeTx(this.db, async (trx) => {
      // Update root page
      const nextPosition = await this.nextPagePosition(spaceId);
      await this.pageRepo.updatePage(
        {
          spaceId,
          parentPageId: parentPageId ?? null,
          position: nextPosition,
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

    const pageUpdateResult = await this.pageRepo.updatePage(
      updatePageData,
      pageId,
      trx,
    );

    return pageUpdateResult;
  }

  async updatePageBlocks(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    // Убираем эту функцию, так как content больше не существует в pages
    // Блоки обрабатываются отдельно через saveBlocksForPage
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

    await this.pageRepo.updatePage(
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
  async updatePage(id: string, dto: UpdatePageDto, userId: string) {
    // Обновляем только метаданные страницы
    await this.pageRepo.updatePage(
      {
        title: dto.title,
        icon: dto.icon,
        lastUpdatedById: userId,
        updatedAt: new Date(),
      },
      id,
    );

    // Сохранение блоков делается на клиенте через /pages/blocks/:pageId
  }

  async getAllBlocksOfPage(pageId: string, userId: string) {
    const allBlocks = await this.db
      .selectFrom('blocks')
      .select(['id', 'pageId', 'blockType', 'position', 'content'])
      .where('pageId', '=', pageId)
      .orderBy('position', 'asc')
      .execute();

    const permissions = await this.db
      .selectFrom('blockPermissions')
      .select(['blockId', 'permission'])
      .where('pageId', '=', pageId)
      .where('userId', '=', userId)
      .execute();

    const permissionMap = new Map(permissions.map(p => [p.blockId, p.permission]));
    const processedBlockIds = new Set(); // Для отслеживания дубликатов

    return allBlocks
      .filter(block => {
        // Убираем дубликаты по ID
        if (processedBlockIds.has(block.id)) {
          this.logger.warn(`Duplicate block ID found in database: ${block.id}, skipping`);
          return false;
        }
        processedBlockIds.add(block.id);
        return true;
      })
      .map(block => {
        const userPermission = permissionMap.get(block.id);
        return {
          ...block,
          hasAccess: !!userPermission,
          userPermission: userPermission ?? 'none',
          content: userPermission ? block.content : null,
        };
      });
  }

  async saveBlocksForPage(pageId: string, blocks: any[], userId: string) {
    console.log('🔄 [PageService] saveBlocksForPage called:', {
      pageId,
      userId,
      blocksCount: blocks?.length || 0
    });

    await this.db.transaction().execute(async (trx) => {
      const existingBlocks = await this.pageRepo.getExistingPageBlocks(pageId, trx);
      console.log('📦 [PageService] Existing blocks:', existingBlocks.map(b => ({ id: b.id, position: b.position })));
      
      const existingBlocksMap = new Map(existingBlocks.map((b) => [b.id, b]));

      const incomingIds = new Set((blocks || []).map((b: any) => b.blockId).filter(Boolean));
      const toDelete = existingBlocks.filter((b) => !incomingIds.has(b.id));

      console.log('🗑️ [PageService] Blocks to delete:', toDelete.map(b => ({ id: b.id, position: b.position })));

      // Удаляем блоки, которых нет в новом списке
      for (const removed of toDelete) {
        console.log('🗑️ [PageService] Deleting block:', removed.id);
        await this.pageRepo.deleteBlock(removed.id, trx);
      }

      // Обрабатываем входящие блоки
      const processedBlockIds = new Set(); // Для отслеживания дубликатов
      
      // Функция для проверки наличия текста в параграфе
      const hasTextContent = (paragraph) => {
        if (!paragraph || !paragraph.content) return false;
        
        // Проверяем, есть ли текстовые узлы с содержимым
        for (const node of paragraph.content) {
          if (node.type === 'text' && node.text && node.text.trim().length > 0) {
            return true;
          }
          // Рекурсивно проверяем вложенные узлы
          if (node.content && hasTextContent(node)) {
            return true;
          }
        }
        return false;
      };
      
      for (const incoming of blocks || []) {
        const blockId: string | undefined = incoming?.blockId;
        const blockType: string | undefined = incoming?.blockType;
        let blockNode: any = incoming?.content ?? {};

        if (!blockNode || typeof blockNode !== 'object') continue;
        
        // Проверяем на дубликаты
        if (blockId && processedBlockIds.has(blockId)) {
          this.logger.warn(`Duplicate block ID detected: ${blockId}, skipping`);
          continue;
        }
        
        blockNode.attrs = blockNode.attrs || {};
        if (blockId) {
          blockNode.attrs.blockId = blockId;
          processedBlockIds.add(blockId);
        }
        if (!blockNode.type && blockType) blockNode.type = blockType;

        // Убеждаемся, что position установлен
        if (blockNode.attrs.position === undefined || blockNode.attrs.position === null) {
          // Если position не установлен, используем позицию из существующего блока или 0
          const existingBlock = blockId ? existingBlocksMap.get(blockId) : undefined;
          blockNode.attrs.position = existingBlock?.position ?? 0;
        }

        // Проверяем, не содержит ли блок несколько параграфов
        if (blockNode.type === 'doc' && Array.isArray(blockNode.content)) {
          const paragraphs = blockNode.content.filter(node => 
            typeof node === 'object' && node !== null && node.type === 'paragraph'
          );
          if (paragraphs.length > 1) {
            // Берем только первый параграф
            blockNode.content = [paragraphs[0]];
            this.logger.debug(`Multiple paragraphs detected in block ${blockId}, using only first paragraph`);
          } else if (paragraphs.length === 1) {
            // Проверяем, что параграф не пустой
            const paragraph = paragraphs[0];
            if (!hasTextContent(paragraph)) {
              // Если параграф пустой, пропускаем этот блок
              this.logger.debug(`Empty paragraph detected in block ${blockId}, skipping`);
              continue;
            }
          }
        }

        const calculatedHash = calculateBlockHash(blockNode);
        const existed = blockId ? existingBlocksMap.get(blockId) : undefined;

        if (!existed) {
          console.log('➕ [PageService] Creating new block:', blockId);
          await this.pageRepo.createBlock(blockNode, blockId, pageId, calculatedHash, trx);
        } else if (existed.stateHash !== calculatedHash) {
          console.log('🔄 [PageService] Updating existing block:', blockId);
          await this.pageRepo.updateExistingBlock(blockNode, blockId, calculatedHash, trx);
        } else {
          console.log('⏭️ [PageService] Block unchanged, skipping:', blockId);
        }
      }
      
      console.log('✅ [PageService] saveBlocksForPage completed successfully');
    });
  }

  async getMyPages(
    userId: string,
    pagination: PaginationOptions,
    pageId?: string,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    return this.pageRepo.getMyPages(userId, pagination, pageId);
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

    const pageUpdateResult = await this.pageRepo.updatePage(
      updatePageData,
      pageId,
      trx,
    );

    return pageUpdateResult;
  }

  async copyPage(
    copyPageDto: CopyPageDto,
    userId: string,
    workspaceId: string,
  ) {
    const { parentPageId, originPageId, spaceId } = copyPageDto;

    if (parentPageId) {
      const parentPage = await this.pageRepo.findById(parentPageId);
      if (!parentPage) {
        throw new NotFoundException(`Parent page "${parentPageId}" not found.`);
      }
      if (parentPage.spaceId !== spaceId) {
        throw new NotFoundException(
          `Parent page "${parentPageId}" does not belong to space "${spaceId}".`,
        );
      }
    }

    const originPage = await this.pageRepo.findById(originPageId, {
      includeContent: true,
    });
    if (!originPage) {
      throw new NotFoundException('Origin page not found');
    }

    const newPage = await executeTx<Page>(this.db, async (trx) => {
      const position = await this.nextPagePosition(spaceId, parentPageId);

      const copyPage = await this.pageRepo.insertPage(
        {
          slugId: generateSlugId(),
          title: `${originPage.title} - Copy`,
          position,
          icon: originPage.icon,
          parentPageId,
          spaceId,
          creatorId: userId,
          workspaceId,
          lastUpdatedById: userId,
        },
        trx,
      );

      // Копируем блоки вместо content
      const originBlocks = await this.pageRepo.getExistingPageBlocks(originPageId, trx);
      for (const block of originBlocks) {
        await this.pageRepo.createBlock(
          block.content,
          block.id,
          copyPage.id,
          block.stateHash,
          trx,
        );
      }

      await this.pageMemberRepo.insertPageMember(
        {
          userId,
          pageId: copyPage.id,
          role: SpaceRole.ADMIN,
          addedById: userId,
        },
        trx,
      );

      return copyPage;
    });

    return newPage;
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
