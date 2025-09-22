/**
 * Скрипт для миграции существующих страниц - добавление обязательного первого блока
 *
 * Этот скрипт:
 * 1. Находит все страницы без обязательного первого блока
 * 2. Добавляет обязательный первый блок в начало каждой страницы
 * 3. Обновляет позиции существующих блоков
 * 4. Сохраняет изменения на сервере
 */

import { createRequiredFirstBlock, validateAndFixBlocks, isRequiredFirstBlock } from '../features/editor/utils/required-first-block';

interface MigrationResult {
  pageId: string;
  success: boolean;
  addedBlockId?: string;
  error?: string;
  blocksCount: number;
}

interface MigrationStats {
  totalPages: number;
  successfulMigrations: number;
  failedMigrations: number;
  skippedPages: number;
  errors: string[];
}

/**
 * Мигрирует одну страницу - добавляет обязательный первый блок
 */
async function migratePage(pageId: string): Promise<MigrationResult> {
  try {
    console.log(`🔄 Migrating page: ${pageId}`);

    // 1. Загружаем существующие блоки
    const response = await fetch(`/api/pages/blocks/${pageId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch blocks: ${response.statusText}`);
    }

    const existingBlocks = await response.json();
    console.log(`📄 Found ${existingBlocks.length} blocks in page ${pageId}`);

    // 2. Проверяем, есть ли уже обязательный первый блок
    const hasRequiredFirstBlock = existingBlocks.some(block => isRequiredFirstBlock(block));

    if (hasRequiredFirstBlock) {
      console.log(`✅ Page ${pageId} already has required first block, skipping`);
      return {
        pageId,
        success: true,
        blocksCount: existingBlocks.length
      };
    }

    // 3. Валидируем и исправляем структуру блоков
    const migratedBlocks = validateAndFixBlocks(existingBlocks, pageId, {
      placeholder: 'Начните писать...'
    });

    const requiredFirstBlock = migratedBlocks.find(block => isRequiredFirstBlock(block));

    if (!requiredFirstBlock) {
      throw new Error('Failed to create required first block');
    }

    console.log(`➕ Added required first block: ${requiredFirstBlock.id}`);

    // 4. Отправляем обновленные блоки на сервер
    const serverData = migratedBlocks.map(block => ({
      blockId: block.id,
      blockType: block.blockType,
      pageId: block.pageId,
      content: block.content
    }));

    const saveResponse = await fetch(`/api/pages/blocks/${pageId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(serverData)
    });

    if (!saveResponse.ok) {
      throw new Error(`Failed to save blocks: ${saveResponse.statusText}`);
    }

    console.log(`✅ Successfully migrated page ${pageId}`);

    return {
      pageId,
      success: true,
      addedBlockId: requiredFirstBlock.id,
      blocksCount: migratedBlocks.length
    };

  } catch (error) {
    console.error(`❌ Failed to migrate page ${pageId}:`, error);
    return {
      pageId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      blocksCount: 0
    };
  }
}

/**
 * Получает список всех страниц в пространстве
 */
async function getAllPages(spaceId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/spaces/${spaceId}/pages`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.statusText}`);
    }

    const pages = await response.json();
    return pages;
  } catch (error) {
    console.error('Failed to fetch pages:', error);
    return [];
  }
}

/**
 * Мигрирует все страницы в пространстве
 */
async function migrateAllPages(spaceId: string): Promise<MigrationStats> {
  console.log(`🚀 Starting migration for space: ${spaceId}`);

  const stats: MigrationStats = {
    totalPages: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    skippedPages: 0,
    errors: []
  };

  try {
    // 1. Получаем все страницы
    const pages = await getAllPages(spaceId);
    stats.totalPages = pages.length;

    console.log(`📚 Found ${pages.length} pages to check`);

    // 2. Мигрируем каждую страницу
    for (const page of pages) {
      const result = await migratePage(page.id);

      if (result.success) {
        if (result.addedBlockId) {
          stats.successfulMigrations++;
        } else {
          stats.skippedPages++;
        }
      } else {
        stats.failedMigrations++;
        stats.errors.push(`Page ${result.pageId}: ${result.error}`);
      }

      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Migration completed!`);
    console.log(`📊 Stats:`, stats);

    return stats;

  } catch (error) {
    console.error('Migration failed:', error);
    stats.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return stats;
  }
}

/**
 * Мигрирует конкретную страницу по ID
 */
async function migrateSpecificPage(pageId: string): Promise<MigrationResult> {
  console.log(`🎯 Migrating specific page: ${pageId}`);
  return await migratePage(pageId);
}

/**
 * Проверяет статус миграции для страницы
 */
async function checkMigrationStatus(pageId: string): Promise<{
  hasRequiredFirstBlock: boolean;
  blocksCount: number;
  requiredBlockId?: string;
}> {
  try {
    const response = await fetch(`/api/pages/blocks/${pageId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch blocks: ${response.statusText}`);
    }

    const blocks = await response.json();
    const requiredFirstBlock = blocks.find(block => isRequiredFirstBlock(block));

    return {
      hasRequiredFirstBlock: !!requiredFirstBlock,
      blocksCount: blocks.length,
      requiredBlockId: requiredFirstBlock?.id
    };

  } catch (error) {
    console.error('Failed to check migration status:', error);
    return {
      hasRequiredFirstBlock: false,
      blocksCount: 0
    };
  }
}

// Экспортируем функции для использования в консоли браузера
if (typeof window !== 'undefined') {
  (window as any).migrateRequiredFirstBlock = {
    migratePage: migrateSpecificPage,
    migrateAllPages,
    checkStatus: checkMigrationStatus
  };

  console.log('🔧 Migration functions available in window.migrateRequiredFirstBlock');
  console.log('Usage:');
  console.log('  window.migrateRequiredFirstBlock.migratePage("page-id")');
  console.log('  window.migrateRequiredFirstBlock.migrateAllPages("space-id")');
  console.log('  window.migrateRequiredFirstBlock.checkStatus("page-id")');
}

export {
  migratePage,
  migrateAllPages,
  migrateSpecificPage,
  checkMigrationStatus,
  type MigrationResult,
  type MigrationStats
};

