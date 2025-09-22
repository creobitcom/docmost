/**
 * Утилиты для работы с обязательным первым блоком
 * Обеспечивает, что на странице всегда есть хотя бы один блок, который нельзя удалить
 */

export interface RequiredFirstBlockConfig {
  /** ID первого блока (генерируется автоматически) */
  firstBlockId: string;
  /** Тип первого блока */
  blockType: 'paragraph' | 'heading';
  /** Заголовок первого блока (если blockType === 'heading') */
  title?: string;
  /** Плейсхолдер для первого блока */
  placeholder?: string;
}

/**
 * Создает конфигурацию для обязательного первого блока
 */
export function createRequiredFirstBlockConfig(pageId: string): RequiredFirstBlockConfig {
  return {
    firstBlockId: window.crypto.randomUUID(), // Генерируем валидный UUID
    blockType: 'paragraph',
    placeholder: 'Начните писать...'
  };
}

/**
 * Создает обязательный первый блок
 */
export function createRequiredFirstBlock(pageId: string, config?: Partial<RequiredFirstBlockConfig>): any {
  const defaultConfig = createRequiredFirstBlockConfig(pageId);
  const finalConfig = { ...defaultConfig, ...config };

  const blockId = finalConfig.firstBlockId;
  const blockType = finalConfig.blockType;

  if (blockType === 'heading') {
    return {
      id: blockId,
      pageId: pageId,
      blockType: 'heading',
      position: 0,
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: {
              level: 1,
              textAlign: 'left',
              position: 0,
              blockId: blockId,
              isRequired: true // Флаг обязательного блока
            },
            content: finalConfig.title ? [{ type: 'text', text: finalConfig.title }] : []
          }
        ]
      },
      hasAccess: true,
      userPermission: 'owner',
      isRequired: true // Флаг обязательного блока
    };
  } else {
    return {
      id: blockId,
      pageId: pageId,
      blockType: 'paragraph',
      position: 0,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {
              textAlign: 'left',
              position: 0,
              blockId: blockId,
              isRequired: true // Флаг обязательного блока
            },
            content: []
          }
        ]
      },
      hasAccess: true,
      userPermission: 'owner',
      isRequired: true // Флаг обязательного блока
    };
  }
}

/**
 * Проверяет, является ли блок обязательным первым блоком
 */
export function isRequiredFirstBlock(block: any): boolean {
  return block?.isRequired === true;
}

/**
 * Проверяет, можно ли удалить блок
 */
export function canDeleteBlock(block: any, allBlocks: any[]): boolean {
  // Нельзя удалить последний блок на странице
  if (allBlocks.length === 1) {
    return false;
  }

  return true;
}

/**
 * Получает обязательный первый блок из списка блоков
 */
export function getRequiredFirstBlock(blocks: any[]): any | null {
  return blocks.find(block => isRequiredFirstBlock(block)) || null;
}

/**
 * Обеспечивает наличие обязательного первого блока в списке блоков
 */
export function ensureRequiredFirstBlock(blocks: any[], pageId: string, config?: Partial<RequiredFirstBlockConfig>): any[] {
  const requiredFirstBlock = getRequiredFirstBlock(blocks);

  if (!requiredFirstBlock) {
    // Создаем обязательный первый блок
    const newRequiredBlock = createRequiredFirstBlock(pageId, config);
    
    // Если есть другие блоки, вставляем обязательный блок в начало
    if (blocks.length > 0) {
      const updatedBlocks = blocks.map((block, index) => ({
        ...block,
        position: index + 1 // Сдвигаем позиции остальных блоков
      }));
      
      return [newRequiredBlock, ...updatedBlocks];
    } else {
      return [newRequiredBlock];
    }
  }

  // Убеждаемся, что обязательный блок находится в позиции 0
  const otherBlocks = blocks.filter(block => !isRequiredFirstBlock(block));
  const sortedBlocks = [requiredFirstBlock, ...otherBlocks].map((block, index) => ({
    ...block,
    position: index
  }));

  return sortedBlocks;
}

/**
 * Валидирует структуру блоков и исправляет проблемы
 */
export function validateAndFixBlocks(blocks: any[], pageId: string, config?: Partial<RequiredFirstBlockConfig>): any[] {
  let fixedBlocks = [...blocks];

  // 1. Обеспечиваем наличие обязательного первого блока только если блоков нет
  if (blocks.length === 0) {
    fixedBlocks = ensureRequiredFirstBlock(fixedBlocks, pageId, config);
  }

  // 2. Убеждаемся, что позиции блоков корректны
  fixedBlocks = fixedBlocks.map((block, index) => ({
    ...block,
    position: index
  }));

  // 3. Убеждаемся, что обязательный блок имеет правильные атрибуты
  const requiredBlock = getRequiredFirstBlock(fixedBlocks);
  if (requiredBlock) {
    const requiredBlockIndex = fixedBlocks.findIndex(block => block.id === requiredBlock.id);
    if (requiredBlockIndex !== 0) {
      // Перемещаем обязательный блок в начало
      const [movedBlock] = fixedBlocks.splice(requiredBlockIndex, 1);
      fixedBlocks.unshift(movedBlock);
      
      // Обновляем позиции
      fixedBlocks = fixedBlocks.map((block, index) => ({
        ...block,
        position: index
      }));
    }
  }

  return fixedBlocks;
}

/**
 * Создает миграцию для существующих страниц без обязательного первого блока
 */
export function createMigrationScript(pageId: string, existingBlocks: any[], config?: Partial<RequiredFirstBlockConfig>): {
  blocks: any[];
  migration: {
    type: 'add_required_first_block';
    pageId: string;
    addedBlockId: string;
    timestamp: string;
  };
} {
  const requiredFirstBlock = getRequiredFirstBlock(existingBlocks);
  
  if (requiredFirstBlock) {
    // Обязательный блок уже существует
    return {
      blocks: validateAndFixBlocks(existingBlocks, pageId, config),
      migration: {
        type: 'add_required_first_block',
        pageId: pageId,
        addedBlockId: requiredFirstBlock.id,
        timestamp: new Date().toISOString()
      }
    };
  } else {
    // Создаем новый обязательный блок
    const newRequiredBlock = createRequiredFirstBlock(pageId, config);
    const migratedBlocks = ensureRequiredFirstBlock(existingBlocks, pageId, config);
    
    return {
      blocks: migratedBlocks,
      migration: {
        type: 'add_required_first_block',
        pageId: pageId,
        addedBlockId: newRequiredBlock.id,
        timestamp: new Date().toISOString()
      }
    };
  }
}
