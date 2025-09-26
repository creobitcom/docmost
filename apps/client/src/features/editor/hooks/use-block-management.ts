import { useState, useRef, useCallback, useEffect } from 'react';
import {
  saveBlocksToServer,
  fetchBlocks,
  getNextBlock,
  getPreviousBlock,
  getFirstBlock,
  getLastBlock,
  getBestTargetBlockForDeletion,
  createBlockBetween,
  createBlockAtEnd
} from '../utils/block-utils';
// Удалена старая логика обязательного первого блока

interface UseBlockManagementOptions {
  pageId: string;
  editable: boolean;
}

export const useBlockManagement = ({ pageId, editable }: UseBlockManagementOptions) => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const blocksRef = useRef(blocks);
  const blockRefs = useRef(new Map<string, any>());

  // Обновляем ref только при изменении ссылки на массив блоков
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Функция для оптимизированного поиска элемента блока
  const findBlockElement = useCallback((blockId: string): HTMLElement | null => {
    // Сначала пытаемся найти через ref
    const blockRef = blockRefs.current.get(blockId);
    if (blockRef?.editor?.view?.dom) {
      const element = blockRef.editor.view.dom.closest('[data-block-id]');
      if (element) return element as HTMLElement;
    }

    // Fallback: поиск по DOM
    return document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
  }, []);

  // Функция для фокусировки на блоке
  const focusBlock = useCallback((blockId: string, position: 'start' | 'end' = 'end') => {
    try {
      console.log('[focusBlock] Attempting to focus block:', blockId, 'position:', position);

      const blockRef = blockRefs.current.get(blockId);
      if (!blockRef?.editor) {
        console.warn('Block ref not found for focus:', blockId);
        return false;
      }

      const editor = blockRef.editor;

      // Проверяем, что редактор готов
      if (!editor.isEditable || !editor.view || !editor.view.dom) {
        console.warn('Editor not ready for focus:', blockId);
        return false;
      }

      // Проверяем, что DOM-элемент все еще существует
      if (!editor.view.dom.parentNode) {
        console.warn('Editor DOM element no longer exists:', blockId);
        return false;
      }

      setFocusedBlockId(blockId);

      // Используем requestAnimationFrame для синхронизации с DOM
      requestAnimationFrame(() => {
        try {
          if (position === 'end') {
            editor.commands.focus('end');
          } else {
            editor.commands.focus('start');
          }
          console.log('[focusBlock] Successfully focused block:', blockId);
        } catch (error) {
          console.warn('Error focusing editor:', error);
        }
      });

      return true;
    } catch (error) {
      console.warn('Error in focusBlock:', error);
      return false;
    }
  }, []);

  // Оптимизированная функция для фокусировки на блоке
  const focusBlockWithRetry = useCallback((blockId: string, position: 'start' | 'end' = 'start', maxRetries = 4) => {
    let retryCount = 0;

    const attemptFocus = () => {
      retryCount++;

      // Быстрая проверка всех условий сразу
      const blockRef = blockRefs.current.get(blockId);
      const editor = blockRef?.editor;

      if (blockRef && editor && editor.isEditable && editor.view?.dom) {
        // Блок готов - фокусируемся немедленно
        try {
          setFocusedBlockId(blockId);
          if (position === 'end') {
            editor.commands.focus('end');
          } else {
            editor.commands.focus('start');
          }
          return; // Успешно сфокусировались
        } catch (error) {
          console.warn('Error focusing editor:', error);
        }
      }

      // Если не удалось сфокусироваться и есть еще попытки
      if (retryCount < maxRetries) {
        // Быстрые интервалы: 10ms, 20ms, 30ms, 40ms
        const delay = retryCount * 10;
        setTimeout(attemptFocus, delay);
      } else {
        // Последняя попытка - используем DOM фокусировку
        focusBlockViaDOM(blockId, position);
      }
    };

    // Начинаем немедленно
    attemptFocus();
  }, []);

  // Быстрая альтернативная функция для фокусировки через DOM
  const focusBlockViaDOM = useCallback((blockId: string, position: 'start' | 'end' = 'start') => {
    try {
      // Находим блок в DOM
      const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
      if (!blockElement) return false;

      // Находим редактор внутри блока
      const editorElement = blockElement.querySelector('.ProseMirror') as HTMLTextAreaElement;
      if (!editorElement) return false;

      // Фокусируемся на редакторе
      editorElement.focus();

      // Устанавливаем курсор в нужную позицию
      if (editorElement.setSelectionRange) {
        const textLength = editorElement.textContent?.length || 0;
        const cursorPosition = position === 'end' ? textLength : 0;
        editorElement.setSelectionRange(cursorPosition, cursorPosition);
      }

      setFocusedBlockId(blockId);
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // Безопасное удаление блока с правильной последовательностью
  const deleteBlockSafely = useCallback(async (blockId: string) => {
    try {
      // 1. Проверяем состояние
      if (isDeleting) {
        console.warn('Block deletion already in progress, skipping');
        return;
      }

      // 2. Проверяем готовность системы
      if (!isReady) {
        console.warn('System not ready for block deletion, waiting...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setIsDeleting(true);

      // 3. Получаем ссылку на блок и проверяем его существование
      const blockRef = blockRefs.current.get(blockId);
      const blockToDelete = blocks.find(b => b.id === blockId);

      if (!blockToDelete) {
        console.warn('Block not found for deletion:', blockId);
        return;
      }

      // 4. Проверяем, можно ли удалить этот блок (нельзя удалить последний блок)
      if (blocks.length === 1) {
        console.warn('Cannot delete the last block on the page');
        setIsDeleting(false);
        return;
      }

      // 5. Начинаем анимацию удаления
      const blockElement = findBlockElement(blockId);

      if (blockElement) {
        // Добавляем класс для анимации удаления
        blockElement.classList.add('block-deleting');

        // Ждем завершения анимации
        await new Promise<void>(resolve => {
          const onAnimationEnd = () => {
            blockElement.removeEventListener('animationend', onAnimationEnd);
            resolve();
          };
          blockElement.addEventListener('animationend', onAnimationEnd);

          // Fallback на случай, если анимация не сработает
          setTimeout(resolve, 300);
        });
      }

      // 6. Подготавливаем данные для сервера
      const updatedBlocks = blocks.filter(b => b.id !== blockId);
      const serverData = updatedBlocks.map((block, index) => ({
        blockId: block.id,
        blockType: block.blockType,
        pageId: block.pageId,
        content: {
          ...block.content,
          attrs: {
            ...block.content.attrs,
            position: index
          }
        }
      }));

      // 7. Отправляем на сервер ПЕРЕД обновлением состояния
      await saveBlocksToServer(pageId, serverData);

      // 8. Уничтожаем Y.js провайдер СИНХРОННО
      if (blockRef?.provider) {
        try {
          console.log('[deleteBlockSafely] Destroying provider for block:', blockId);

          // Проверяем состояние провайдера перед уничтожением
          if (blockRef.provider.isConnected) {
            blockRef.provider.disconnect();
          }

          // Добавляем небольшую задержку перед уничтожением
          await new Promise(resolve => setTimeout(resolve, 10));

          blockRef.provider.destroy();
        } catch (error) {
          console.warn('Error destroying provider:', error);
        }
      }

      // 9. Удаляем ссылки на блок
      blockRefs.current.delete(blockId);

      // 10. Обновляем состояние React без пересборки
      setBlocks(prevBlocks => {
        const newBlocks = prevBlocks.filter(b => b.id !== blockId);

        // Обновляем позиции оставшихся блоков
        return newBlocks.map((block, index) => ({
          ...block,
          content: {
            ...block.content,
            attrs: {
              ...block.content.attrs,
              position: index
            }
          }
        }));
      });

      // 11. Фокусируемся на лучшем целевом блоке
      setTimeout(() => {
        try {
          const targetInfo = getBestTargetBlockForDeletion(blocks, blockId);
          if (targetInfo) {
            focusBlockWithRetry(targetInfo.block.id, targetInfo.position);
          }
        } catch (error) {
          console.warn('Failed to focus target block after deletion:', error);
        }
      }, 50);

    } catch (error) {
      console.error('Failed to delete block:', error);
    } finally {
      setTimeout(() => setIsDeleting(false), 100);
    }
  }, [blocks, isDeleting, isReady, pageId, findBlockElement, focusBlockWithRetry]);

  // Обработчик создания блока (теперь только для логирования и фокуса)
  const handleBlockCreated = useCallback((newBlock: any) => {
    console.log('[handleBlockCreated] Block created:', newBlock);

    // Фокусируемся на новом блоке немедленно (убрали setTimeout для оптимизации)
    focusBlockWithRetry(newBlock.id, 'start');
  }, [focusBlockWithRetry]);

  // Обработчик удаления блока
  const handleBlockDeleted = useCallback((blockId: string) => {
    deleteBlockSafely(blockId);
  }, [deleteBlockSafely]);

  // Функция для загрузки блоков
  const loadBlocks = useCallback(async () => {
    const blocksData = await fetchBlocks(pageId);

    // Если блоков нет - создаем один пустой блок
    if (blocksData.length === 0 && !isInitialized) {
      console.log("No blocks found, creating initial empty block");

      // Создаем пустой блок
      const initialBlock = {
        id: window.crypto.randomUUID(),
        pageId: pageId,
        blockType: 'paragraph',
        position: 0,
        content: {
          type: 'doc',
          content: [] // Начинаем с пустого контента
        },
        hasAccess: true,
        userPermission: 'owner'
      };

      console.log("Initial block created:", initialBlock);

      // Отправляем блок на сервер
      saveBlocksToServer(pageId, [{
        blockId: initialBlock.id,
        blockType: initialBlock.blockType,
        pageId: initialBlock.pageId,
        content: initialBlock.content,
        hasAccess: initialBlock.hasAccess,
        userPermission: initialBlock.userPermission
      }]);

      setBlocks([initialBlock]);
    } else {
      // Блоки есть - сортируем их по позициям и устанавливаем
      console.log("Blocks found, setting blocks:", blocksData.length);
      
      // Сортируем блоки по позициям
      const sortedBlocks = blocksData.sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        return posA - posB;
      });
      
      console.log("Blocks sorted by position:", sortedBlocks.map(b => ({ id: b.id, position: b.position })));
      setBlocks(sortedBlocks);
    }

    setIsInitialized(true);
  }, [pageId, isInitialized]);

  // Навигационные функции
  const navigateUp = useCallback((currentBlockId: string) => {
    const prevBlock = getPreviousBlock(blocks, currentBlockId);
    if (prevBlock) {
      focusBlockWithRetry(prevBlock.id, 'end');
    }
  }, [blocks, focusBlockWithRetry]);

  const navigateDown = useCallback((currentBlockId: string) => {
    const nextBlock = getNextBlock(blocks, currentBlockId);
    if (nextBlock) {
      focusBlockWithRetry(nextBlock.id, 'start');
    }
  }, [blocks, focusBlockWithRetry]);

  const navigateToFirst = useCallback(() => {
    const firstBlock = getFirstBlock(blocks);
    if (firstBlock) {
      focusBlockWithRetry(firstBlock.id, 'start');
    }
  }, [blocks, focusBlockWithRetry]);

  const navigateToLast = useCallback(() => {
    const lastBlock = getLastBlock(blocks);
    if (lastBlock) {
      focusBlockWithRetry(lastBlock.id, 'end');
    }
  }, [blocks, focusBlockWithRetry]);

  return {
    // Состояние
    blocks,
    setBlocks,
    isInitialized,
    focusedBlockId,
    setFocusedBlockId,
    isDeleting,
    isReady,
    setIsReady,
    blocksRef,
    blockRefs,

    // Функции
    loadBlocks,
    handleBlockCreated,
    handleBlockDeleted,
    focusBlock,
    focusBlockWithRetry,
    deleteBlockSafely,
    findBlockElement,

    // Навигация
    navigateUp,
    navigateDown,
    navigateToFirst,
    navigateToLast,

    // Утилиты
    getNextBlock: (currentBlockId: string) => getNextBlock(blocks, currentBlockId),
    getPreviousBlock: (currentBlockId: string) => getPreviousBlock(blocks, currentBlockId),
    getFirstBlock: () => getFirstBlock(blocks),
    getLastBlock: () => getLastBlock(blocks),
    createBlockBetween: (afterBlockId: string, beforeBlockId?: string) => createBlockBetween(pageId, blocks, afterBlockId, beforeBlockId),
    createBlockAtEnd: () => createBlockAtEnd(pageId, blocks),
  };
};


