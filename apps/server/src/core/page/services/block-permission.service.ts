import { Injectable } from '@nestjs/common';
import { SaveBlockPermissionDto } from '../dto/save-block-permission.dto';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';
import { PageMemberRepo } from '@docmost/db/repos/page/page-member.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { BlockPermissionRepo as BlockPermissionRepoNew } from '@docmost/db/repos/block/block-permission.repo';

@Injectable()
export class BlockPermissionService {
  constructor(
    @InjectKysely() public readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly synchronizedPageRepo: SynchronizedPageRepo,
    private readonly pageMemberRepo: PageMemberRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly blockPermissionRepo: BlockPermissionRepoNew,
  ) {}

  async updateBlockPermission({
    userId,
    pageId,
    blockId,
    permission,
    role,
  }: {
    userId: string;
    pageId: string;
    blockId: string;
    permission: 'read' | 'edit' | 'owner';
    role: string;
  }) {
    return this.saveBlockPermissionWithCascade({
      userId,
      pageId,
      blockId,
      permission,
      role,
    });
  }

  async saveBlockPermission(dto: SaveBlockPermissionDto) {
    return this.blockPermissionRepo.insert({
      pageId: dto.pageId,
      blockId: dto.blockId,
      userId: dto.userId,
      role: dto.role,
      permission: dto.permission,
    });
  }

  async saveBlockPermissionWithCascade(dto: SaveBlockPermissionDto) {
    // 1. Saving block permission
    await this.saveBlockPermission(dto);

    // 2. Checking — page permission
    const existingPageMember = await this.pageMemberRepo.getPageMemberByTypeId(
      dto.pageId,
      { userId: dto.userId },
    );

    if (!existingPageMember) {
      await this.pageMemberRepo.insertPageMember({
        pageId: dto.pageId,
        userId: dto.userId,
        role: 'reader', // min access
        source: 'block',
      });
    }

    // 3. Getting space Id for page
    const page = await this.pageRepo.findById(dto.pageId);

    // 4. Checking — space access
    const existingSpaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
      page.spaceId,
      { userId: dto.userId },
    );

    if (!existingSpaceMember) {
      await this.spaceMemberRepo.insertSpaceMember({
        spaceId: page.spaceId,
        userId: dto.userId,
        role: 'reader', // min access
      });
    }
  }

  async deleteBlockPermission(dto: { blockId: string; userId: string }) {
    return this.blockPermissionRepo.deleteByBlockIdAndUserId(dto.blockId, dto.userId);
  }

  async getAccessiblePageBlocks(pageId: string, userId: string) {
    const page = await this.pageRepo.findById(pageId);

    if (!page) {
      return [];
    }

    // Если это синхронизированная страница, получаем блоки из origin страницы
    if (page.isSynced) {
      const syncPage = await this.synchronizedPageRepo.findByReferencePageId(pageId);

      if (syncPage) {
        // Получаем блоки из origin страницы, но используем текущий pageId для проверки разрешений
        return this.getAccessiblePageBlocksForOriginPage(syncPage.originPageId, pageId, userId);
      }
    }

    // Обычная логика для несинхронизированных страниц
    return this.getAccessiblePageBlocksForCurrentPage(pageId, userId);
  }

  private async getAccessiblePageBlocksForOriginPage(originPageId: string, currentPageId: string, userId: string) {
    // Получаем информацию о текущей странице для проверки разрешений
    const currentPage = await this.pageRepo.findById(currentPageId);

    if (!currentPage) {
      return [];
    }

    const isCreator = currentPage.creatorId === userId;
    const hasPageAccess = await this.userHasDirectPageAccess(userId, currentPageId);

    // Получаем блоки из origin страницы с полной информацией
    const blocks = await this.db
      .selectFrom('blocks')
      .select(['id', 'pageId', 'blockType', 'content', 'position'])
      .where('pageId', '=', originPageId)
      .orderBy('position')
      .execute();

    // Создатель синхронизированной страницы видит все блоки
    if (isCreator) {
      return blocks.map((block) => ({
        id: block.id,
        pageId: currentPageId, // Используем ID текущей страницы
        blockType: block.blockType,
        position: block.position,
        hasAccess: true,
        userPermission: 'owner',
        content: (typeof block.content === 'string' ? JSON.parse(block.content) : block.content) ?? null,
      }));
    }

    const pageMember = await this.pageMemberRepo.getPageMemberByTypeId(currentPageId, { userId });

    const hasDirectPageAccess = pageMember?.source === 'manual';

    // Обрабатываем блоки асинхронно
    const processedBlocks = await Promise.all(
      blocks.map(async (block) => {
        const userIsCreator = currentPage.creatorId === userId;

        if (userIsCreator) {
          let parsedContent;
          try {
            parsedContent = typeof block.content === 'string'
              ? JSON.parse(block.content)
              : block.content;
            
            // Проверяем, не содержит ли контент несколько параграфов
            if (parsedContent && typeof parsedContent === 'object' && 
                parsedContent.type === 'doc' && Array.isArray(parsedContent.content)) {
              const paragraphs = parsedContent.content.filter(node => 
                typeof node === 'object' && node !== null && node.type === 'paragraph'
              );
              if (paragraphs.length > 1) {
                // Берем только первый параграф
                parsedContent.content = [paragraphs[0]];
              }
            }
          } catch (e) {
            console.warn('Failed to parse block content:', block.content);
            parsedContent = null;
          }

          return {
            id: block.id,
            pageId: currentPageId, // Используем ID текущей страницы
            blockType: block.blockType,
            position: block.position,
            hasAccess: true,
            userPermission: 'owner',
            content: parsedContent,
          };
        }

        // Для синхронизированных страниц проверяем разрешения на блоки из origin страницы
        const hasBlockAccess = await this.checkBlockPermission(block.id, userId);
        const isPublic = await this.checkPublicBlockPermission(block.id);
        const isUnrestricted = !(await this.hasBlockPermissions(block.id));

        const hasAccess = hasDirectPageAccess
          ? hasBlockAccess || isPublic || isUnrestricted
          : hasBlockAccess;

        let parsedContent = null;
        if (hasAccess) {
          try {
            parsedContent = typeof block.content === 'string'
              ? JSON.parse(block.content)
              : block.content;
            
            // Проверяем, не содержит ли контент несколько параграфов
            if (parsedContent && typeof parsedContent === 'object' && 
                parsedContent.type === 'doc' && Array.isArray(parsedContent.content)) {
              const paragraphs = parsedContent.content.filter(node => 
                typeof node === 'object' && node !== null && node.type === 'paragraph'
              );
              if (paragraphs.length > 1) {
                // Берем только первый параграф
                parsedContent.content = [paragraphs[0]];
              }
            }
          } catch (e) {
            console.warn('Failed to parse block content:', block.content);
            parsedContent = null;
          }
        }

        return {
          id: block.id,
          pageId: currentPageId, // Используем ID текущей страницы
          blockType: block.blockType,
          position: block.position,
          hasAccess,
          userPermission: hasBlockAccess ? 'read' : null,
          content: parsedContent,
        };
      })
    );

    return processedBlocks;
  }

  private async getAccessiblePageBlocksForCurrentPage(pageId: string, userId: string) {
    const page = await this.pageRepo.findById(pageId);

    if (!page) {
      return [];
    }

    const isCreator = page.creatorId === userId;
    const hasPageAccess = await this.userHasDirectPageAccess(userId, pageId);

    // Получаем блоки с полной информацией
    const blocks = await this.db
      .selectFrom('blocks')
      .select(['id', 'pageId', 'blockType', 'content', 'position'])
      .where('pageId', '=', pageId)
      .orderBy('position')
      .execute();

    // Создатель страницы видит все блоки без записей в blockPermissions
    if (isCreator) {
      return blocks.map((block) => {
        let parsedContent;
        try {
          parsedContent = (typeof block.content === 'string' ? JSON.parse(block.content) : block.content) ?? null;
          
          // Проверяем, не содержит ли контент несколько параграфов
          if (parsedContent && typeof parsedContent === 'object' && 
              parsedContent.type === 'doc' && Array.isArray(parsedContent.content)) {
            const paragraphs = parsedContent.content.filter(node => 
              typeof node === 'object' && node !== null && node.type === 'paragraph'
            );
            if (paragraphs.length > 1) {
              // Берем только первый параграф
              parsedContent.content = [paragraphs[0]];
            }
          }
        } catch (e) {
          console.warn('Failed to parse block content:', block.content);
          parsedContent = null;
        }
        
        return {
          id: block.id,
          pageId: block.pageId,
          blockType: block.blockType,
          position: block.position,
          hasAccess: true,
          userPermission: 'owner',
          content: parsedContent,
        };
      });
    }

    const pageMember = await this.pageMemberRepo.getPageMemberByTypeId(pageId, { userId });

    const hasDirectPageAccess = pageMember?.source === 'manual';

    // Обрабатываем блоки асинхронно
    const processedBlocks = await Promise.all(
      blocks.map(async (block) => {
        const userIsCreator = page.creatorId === userId;

        // Если пользователь — создатель страницы, всегда owner-доступ
        if (userIsCreator) {
          let parsedContent;
          try {
            parsedContent = typeof block.content === 'string'
              ? JSON.parse(block.content)
              : block.content;
            
            // Проверяем, не содержит ли контент несколько параграфов
            if (parsedContent && typeof parsedContent === 'object' && 
                parsedContent.type === 'doc' && Array.isArray(parsedContent.content)) {
              const paragraphs = parsedContent.content.filter(node => 
                typeof node === 'object' && node !== null && node.type === 'paragraph'
              );
              if (paragraphs.length > 1) {
                // Берем только первый параграф
                parsedContent.content = [paragraphs[0]];
              }
            }
          } catch (e) {
            console.warn('Failed to parse block content:', block.content);
            parsedContent = null;
          }

          return {
            id: block.id,
            pageId: block.pageId,
            blockType: block.blockType,
            position: block.position,
            hasAccess: true,
            userPermission: 'owner',
            content: parsedContent,
          };
        }

        const hasBlockAccess = await this.checkBlockPermission(block.id, userId);
        const isPublic = await this.checkPublicBlockPermission(block.id);
        const isUnrestricted = !(await this.hasBlockPermissions(block.id));

        const hasAccess = hasDirectPageAccess
          ? hasBlockAccess || isPublic || isUnrestricted
          : hasBlockAccess;

        // Парсим контент из JSON строки
        let parsedContent = null;
        if (hasAccess) {
          try {
            parsedContent = typeof block.content === 'string'
              ? JSON.parse(block.content)
              : block.content;
            
            // Проверяем, не содержит ли контент несколько параграфов
            if (parsedContent && typeof parsedContent === 'object' && 
                parsedContent.type === 'doc' && Array.isArray(parsedContent.content)) {
              const paragraphs = parsedContent.content.filter(node => 
                typeof node === 'object' && node !== null && node.type === 'paragraph'
              );
              if (paragraphs.length > 1) {
                // Берем только первый параграф
                parsedContent.content = [paragraphs[0]];
              }
            }
          } catch (e) {
            console.warn('Failed to parse block content:', block.content);
            parsedContent = null;
          }
        }

        return {
          id: block.id,
          pageId: block.pageId,
          blockType: block.blockType,
          position: block.position,
          hasAccess,
          userPermission: hasBlockAccess ? 'read' : null,
          content: parsedContent,
        };
      })
    );

    return processedBlocks;
  }

  private async checkBlockPermission(blockId: string, userId: string): Promise<boolean> {
    const result = await this.blockPermissionRepo.findByBlockIdAndUserId(blockId, userId);
    return !!result;
  }

  private async checkPublicBlockPermission(blockId: string): Promise<boolean> {
    const result = await this.blockPermissionRepo.findPublicByBlockId(blockId);
    return !!result;
  }

  private async hasBlockPermissions(blockId: string): Promise<boolean> {
    return this.blockPermissionRepo.hasAnyPermissions(blockId);
  }

  async userHasDirectPageAccess(userId: string, pageId: string): Promise<boolean> {
    const pageMember = await this.pageMemberRepo.getPageMemberByTypeId(pageId, { userId });
    const hasAccess = !!pageMember;
    console.log(`[AccessCheck] PageMember exists for user ${userId} on page ${pageId}:`, hasAccess);
    return hasAccess;
  }
}
