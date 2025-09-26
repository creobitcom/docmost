// Утилитарные функции для работы с блоками
import { cleanupBlocksContent } from './cleanup-empty-elements';

export function getTokenFromCollabQuery(collabQuery: any): string | undefined {
  // console.log('[getTokenFromCollabQuery] collabQuery:', collabQuery);
  if (!collabQuery) return undefined;
  if (typeof collabQuery.token === 'string') return collabQuery.token;
  if (collabQuery.data && typeof collabQuery.data.token === 'string') return collabQuery.data.token;
  return undefined;
}

// Дебаунс для предотвращения частых сохранений
const saveTimeouts = new Map<string, NodeJS.Timeout>();

// Периодическое сохранение каждые 3 секунды
const periodicSaveIntervals = new Map<string, NodeJS.Timeout>();
const lastSavedBlocks = new Map<string, any[]>();

export async function saveBlocksToServer(pageId: string, blocks: any[]) {
  console.log('💾 [saveBlocksToServer] Starting save for pageId:', pageId, 'blocks:', blocks.length);
  
  // Валидация входных данных
  if (!pageId || !blocks || !Array.isArray(blocks)) {
    console.error('❌ [saveBlocksToServer] Invalid input data:', { pageId, blocks });
    return;
  }

  // Фильтруем пустые или невалидные блоки
  const validBlocks = blocks.filter(block => {
    if (!block || !block.blockId || !block.blockType) {
      console.warn('⚠️ [saveBlocksToServer] Filtering out invalid block:', block);
      return false;
    }
    return true;
  });

  // Очищаем пустые элементы из контента блоков
  const cleanedBlocks = cleanupBlocksContent(validBlocks);

  if (cleanedBlocks.length === 0) {
    console.warn('⚠️ [saveBlocksToServer] No valid blocks to save after cleanup');
    return;
  }

  // Очищаем предыдущий таймер для этой страницы
  if (saveTimeouts.has(pageId)) {
    clearTimeout(saveTimeouts.get(pageId)!);
    console.log('⏰ [saveBlocksToServer] Cleared previous timeout for pageId:', pageId);
  }

  // Устанавливаем новый таймер с дебаунсом 500ms
  const timeout = setTimeout(async () => {
    console.log('🚀 [saveBlocksToServer] Executing save for pageId:', pageId);
    console.log('📝 [saveBlocksToServer] Cleaned blocks to save:', cleanedBlocks.length);
    
    // Детальное логирование для отладки
    console.log('🔍 [saveBlocksToServer] DETAILED BLOCK DATA:');
    cleanedBlocks.forEach((block, index) => {
      console.log(`Block ${index}:`, {
        blockId: block.blockId,
        blockType: block.blockType,
        pageId: block.pageId,
        hasContent: !!block.content,
        contentSize: block.content ? JSON.stringify(block.content).length : 0,
        isRequired: block.isRequired,
        hasAccess: block.hasAccess,
        userPermission: block.userPermission
      });
    });
    
    try {
      const response = await fetch(`/api/pages/blocks/${pageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blocks: cleanedBlocks }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [saveBlocksToServer] Server error:', response.status, errorText);
        console.error('❌ [saveBlocksToServer] Request body:', JSON.stringify({ blocks: cleanedBlocks }, null, 2));
        
        // Попытка повторного сохранения через 2 секунды
        setTimeout(() => {
          console.log('🔄 [saveBlocksToServer] Retrying save after error...');
          saveBlocksToServer(pageId, cleanedBlocks);
        }, 2000);
      } else {
        const responseData = await response.json();
        console.log('✅ [saveBlocksToServer] Success:', responseData);
        
        // Обновляем кэш последних сохраненных блоков
        lastSavedBlocks.set(pageId, [...cleanedBlocks]);
      }
    } catch (error) {
      console.error('❌ [saveBlocksToServer] Network error:', error);
      console.error('❌ [saveBlocksToServer] Request body:', JSON.stringify({ blocks: cleanedBlocks }, null, 2));
      
      // Попытка повторного сохранения через 3 секунды при сетевой ошибке
      setTimeout(() => {
        console.log('🔄 [saveBlocksToServer] Retrying save after network error...');
        saveBlocksToServer(pageId, cleanedBlocks);
      }, 3000);
    } finally {
      saveTimeouts.delete(pageId);
      console.log('🧹 [saveBlocksToServer] Cleaned up timeout for pageId:', pageId);
    }
  }, 500);

  saveTimeouts.set(pageId, timeout);
  console.log('⏰ [saveBlocksToServer] Set timeout for pageId:', pageId);
}

// Функция для запуска периодического сохранения
export function startPeriodicSave(pageId: string, getBlocks: () => any[]) {
  console.log('🔄 [startPeriodicSave] Starting periodic save for pageId:', pageId);
  
  // Останавливаем предыдущий интервал если есть
  if (periodicSaveIntervals.has(pageId)) {
    clearInterval(periodicSaveIntervals.get(pageId)!);
    console.log('⏹️ [startPeriodicSave] Stopped previous interval for pageId:', pageId);
  }

  // Запускаем новый интервал каждые 3 секунды
  const interval = setInterval(async () => {
    try {
      const currentBlocks = getBlocks();
      const lastSaved = lastSavedBlocks.get(pageId);
      
      // Проверяем, изменились ли блоки
      console.log('🔍 [startPeriodicSave] Checking for changes...', {
        currentBlocksCount: currentBlocks.length,
        lastSavedCount: lastSaved?.length || 0,
        hasLastSaved: !!lastSaved
      });

      // Проверяем каждое условие отдельно для детального логирования
      let hasChanges = false;
      
      if (!lastSaved) {
        console.log('🔄 [startPeriodicSave] No last saved data, forcing save');
        hasChanges = true;
      } else if (currentBlocks.length !== lastSaved.length) {
        console.log('🔄 [startPeriodicSave] Block count changed:', {
          current: currentBlocks.length,
          last: lastSaved.length
        });
        hasChanges = true;
      } else {
        // Проверяем каждый блок детально
        for (let index = 0; index < currentBlocks.length; index++) {
          const block = currentBlocks[index];
          const lastBlock = lastSaved[index];
          
          console.log('🔍 [startPeriodicSave] Checking block:', {
            index,
            blockId: block.blockId,
            hasLastBlock: !!lastBlock,
            currentContent: JSON.stringify(block.content).substring(0, 100) + '...',
            lastContent: lastBlock ? JSON.stringify(lastBlock.content).substring(0, 100) + '...' : 'null'
          });
          
          if (!lastBlock) {
            console.log('🔄 [startPeriodicSave] Block changed: no last block');
            hasChanges = true;
            break;
          } else if (block.blockId !== lastBlock.blockId) {
            console.log('🔄 [startPeriodicSave] Block changed: blockId changed');
            hasChanges = true;
            break;
          } else {
            const currentContentStr = JSON.stringify(block.content);
            const lastContentStr = JSON.stringify(lastBlock.content);
            
            if (currentContentStr !== lastContentStr) {
              console.log('🔄 [startPeriodicSave] Block changed: content changed', {
                blockId: block.blockId,
                currentLength: currentContentStr.length,
                lastLength: lastContentStr.length,
                currentPreview: currentContentStr.substring(0, 200),
                lastPreview: lastContentStr.substring(0, 200)
              });
              hasChanges = true;
              break;
            } else {
              console.log('✅ [startPeriodicSave] Block unchanged:', block.blockId);
            }
          }
        }
      }

      if (hasChanges) {
        console.log('🔄 [startPeriodicSave] Changes detected, saving blocks...');
        await saveBlocksToServer(pageId, currentBlocks);
        lastSavedBlocks.set(pageId, [...currentBlocks]);
      } else {
        console.log('⏭️ [startPeriodicSave] No changes detected, skipping save');
      }
    } catch (error) {
      console.error('❌ [startPeriodicSave] Error during periodic save:', error);
    }
  }, 3000); // 3 секунды

  periodicSaveIntervals.set(pageId, interval);
  
  // Принудительно сохраняем при первом запуске для установки базового состояния
  setTimeout(async () => {
    try {
      const initialBlocks = getBlocks();
      console.log('🔄 [startPeriodicSave] Initial save on startup...');
      await saveBlocksToServer(pageId, initialBlocks);
      lastSavedBlocks.set(pageId, [...initialBlocks]);
      console.log('✅ [startPeriodicSave] Initial save completed');
    } catch (error) {
      console.error('❌ [startPeriodicSave] Error during initial save:', error);
    }
  }, 1000); // Сохраняем через 1 секунду после запуска
  
  console.log('✅ [startPeriodicSave] Periodic save started for pageId:', pageId);
}

// Функция для остановки периодического сохранения
export function stopPeriodicSave(pageId: string) {
  console.log('⏹️ [stopPeriodicSave] Stopping periodic save for pageId:', pageId);
  
  if (periodicSaveIntervals.has(pageId)) {
    clearInterval(periodicSaveIntervals.get(pageId)!);
    periodicSaveIntervals.delete(pageId);
    lastSavedBlocks.delete(pageId);
    console.log('✅ [stopPeriodicSave] Periodic save stopped for pageId:', pageId);
  }
}

// Функция для принудительного сохранения (для тестирования)
export async function forceSaveBlocks(pageId: string, getBlocks: () => any[]) {
  console.log('🔄 [forceSaveBlocks] Force saving blocks for pageId:', pageId);
  
  try {
    const currentBlocks = getBlocks();
    console.log('📝 [forceSaveBlocks] Blocks to save:', currentBlocks.length);
    
    await saveBlocksToServer(pageId, currentBlocks);
    lastSavedBlocks.set(pageId, [...currentBlocks]);
    
    console.log('✅ [forceSaveBlocks] Force save completed successfully');
    return true;
  } catch (error) {
    console.error('❌ [forceSaveBlocks] Error during force save:', error);
    return false;
  }
}

export async function deleteBlock(pageId: string, blockId: string) {
  const response = await fetch(`/api/pages/blocks/${pageId}/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ blockId }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete block');
  }

  return response.json();
}

export async function fetchBlocks(pageId: string) {
  console.log('🔍 [fetchBlocks] Fetching blocks for pageId:', pageId);
  const res = await fetch(`/api/pages/${pageId}/blocks`, { credentials: "include" });
  
  if (!res.ok) {
    console.error('❌ [fetchBlocks] Failed to fetch blocks:', res.status, res.statusText);
    throw new Error(`Failed to fetch blocks: ${res.status}`);
  }
  
  const result = await res.json();
  console.log('📦 [fetchBlocks] Raw API response:', result);
  
  // Универсальная обработка вложенности
  let blocks = Array.isArray(result?.data?.data)
    ? result.data.data
    : Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result)
    ? result
    : [];
  
  // Сортируем блоки по позициям
  const sortedBlocks = blocks.sort((a, b) => {
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    return posA - posB;
  });
  
  console.log('✅ [fetchBlocks] Processed blocks:', {
    pageId,
    blocksCount: sortedBlocks.length,
    blocks: sortedBlocks.map(b => ({ id: b.id, blockType: b.blockType, position: b.position }))
  });
  
  return sortedBlocks;
}

// Функция для проверки наличия текста в параграфе
export function hasTextContent(paragraph: any): boolean {
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
}

// Функция для получения следующего блока
export function getNextBlock(blocks: any[], currentBlockId: string) {
  const currentIndex = blocks.findIndex(block => block.id === currentBlockId);
  if (currentIndex >= 0 && currentIndex < blocks.length - 1) {
    return blocks[currentIndex + 1];
  }
  return null;
}

// Функция для получения предыдущего блока
export function getPreviousBlock(blocks: any[], currentBlockId: string) {
  const currentIndex = blocks.findIndex(block => block.id === currentBlockId);
  if (currentIndex > 0) {
    return blocks[currentIndex - 1];
  }
  return null;
}

// Функция для получения первого блока
export function getFirstBlock(blocks: any[]) {
  return blocks.length > 0 ? blocks[0] : null;
}

// Функция для получения последнего блока
export function getLastBlock(blocks: any[]) {
  return blocks.length > 0 ? blocks[blocks.length - 1] : null;
}

// Функция для получения лучшего целевого блока при удалении
export function getBestTargetBlockForDeletion(blocks: any[], deletedBlockId: string) {
  const currentIndex = blocks.findIndex(block => block.id === deletedBlockId);

  // Если это первый блок, переходим к следующему
  if (currentIndex === 0 && blocks.length > 1) {
    return { block: blocks[1], position: 'start' as const };
  }

  // Если это последний блок, переходим к предыдущему
  if (currentIndex === blocks.length - 1 && blocks.length > 1) {
    return { block: blocks[currentIndex - 1], position: 'end' as const };
  }

  // Если это блок в середине, предпочитаем предыдущий блок
  if (currentIndex > 0 && currentIndex < blocks.length - 1) {
    return { block: blocks[currentIndex - 1], position: 'end' as const };
  }

  return null;
}

// Функция для создания блока между существующими
export function createBlockBetween(pageId: string, blocks: any[], afterBlockId: string, beforeBlockId?: string) {
  console.log('[createBlockBetween] Creating block between:', { afterBlockId, beforeBlockId });
  console.log('[createBlockBetween] Current blocks:', blocks.map(b => ({ id: b.id, position: b.position })));

  const afterBlock = blocks.find(block => block.id === afterBlockId);
  const beforeBlock = beforeBlockId ? blocks.find(block => block.id === beforeBlockId) : null;

  if (!afterBlock) {
    console.warn('[createBlockBetween] After block not found:', afterBlockId);
    return null;
  }

  // Определяем тип блока на основе контекста
  let blockType = 'paragraph';
  let content = {
    type: 'doc',
    content: [] // Начинаем с пустого контента
  };

  // Если предыдущий блок - это список, создаем параграф (не список)
  const isAfterListBlock = afterBlock.blockType && (
    afterBlock.blockType.includes('List') || 
    afterBlock.blockType.includes('list') || 
    afterBlock.blockType.includes('task')
  );

  if (isAfterListBlock) {
    console.log('[createBlockBetween] Creating paragraph after list block to avoid empty list items');
    // Создаем обычный параграф, а не список
    blockType = 'paragraph';
  }

  const newBlock = {
    id: window.crypto.randomUUID(),
    pageId: pageId,
    blockType: blockType,
    position: afterBlock.position + 1,
    content: content,
    hasAccess: true,
    userPermission: 'owner'
  };

  console.log('[createBlockBetween] New block created:', newBlock);
  return newBlock;
}

// Функция для создания блока в конце
export function createBlockAtEnd(pageId: string, blocks: any[]) {
  // Определяем тип блока на основе последнего блока
  let blockType = 'paragraph';
  let content = {
    type: 'doc',
    content: [] // Начинаем с пустого контента
  };

  // Если последний блок - это список, создаем параграф (не список)
  if (blocks.length > 0) {
    const lastBlock = blocks[blocks.length - 1];
    const isLastBlockList = lastBlock.blockType && (
      lastBlock.blockType.includes('List') || 
      lastBlock.blockType.includes('list') || 
      lastBlock.blockType.includes('task')
    );

    if (isLastBlockList) {
      console.log('[createBlockAtEnd] Creating paragraph after list block to avoid empty list items');
      // Создаем обычный параграф, а не список
      blockType = 'paragraph';
    }
  }

  const newBlock = {
    id: window.crypto.randomUUID(),
    pageId: pageId,
    blockType: blockType,
    position: blocks.length,
    content: content,
    hasAccess: true,
    userPermission: 'owner'
  };

  return newBlock;
}


