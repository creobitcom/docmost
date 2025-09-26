import { useEffect, useCallback } from 'react';
import { dndCoordinator } from '../dnd/DndCoordinator';
import { CrossBlockMoveOperation, handleCrossBlockElementMove as handleCrossBlockMove } from '../utils/cross-block-element-utils';
import { cleanupBlocksContent } from '../utils/cleanup-empty-paragraphs';
import { moveElementWithinTiptapEditor, moveElementBetweenTiptapEditors, TiptapMoveOperation } from '../utils/tiptap-cross-block-utils';
import { logCrossBlockTest, TestResult } from '../utils/dnd-test-logger';

interface UseDndEventsOptions {
  blocks: any[];
  blocksRef: React.MutableRefObject<any[]>;
  blockRefs: Map<string, any>;
  isReady: boolean;
  setBlocks: (blocks: any[]) => void;
  saveBlocksToServer: (pageId: string, blocks: any[]) => void;
  pageId: string;
}

export const useDndEvents = ({
  blocks,
  blocksRef,
  blockRefs,
  isReady,
  setBlocks,
  saveBlocksToServer,
  pageId
}: UseDndEventsOptions) => {

  // Логируем монтаж хука только один раз
  useEffect(() => {
    console.log('🚀 [DndEvents] Hook mounted for page:', pageId);
    return () => {
      console.log('🧹 [DndEvents] Hook unmounting for page:', pageId);
    };
  }, []);

  // Глобальная обработка ошибок для предотвращения DOM-конфликтов
  useEffect(() => {
    // Инициализируем координатор DnD и обратную совместимость
    // attachWindowCompat(); // Функция не существует

    // Добавляем тестовый индикатор для отладки DnD
    // setTimeout(() => {
    //   addDndStatusIndicator(); // Функция не существует
    //   logDndState(); // Функция не существует
    // }, 1000);

    // Убрали переопределение window.onerror для предотвращения рекурсии
    // const originalErrorHandler = window.onerror;

    // window.onerror = (message, source, lineno, colno, error) => {
    //   if (message && typeof message === 'string' && (
    //     message.includes('removeChild') ||
    //     message.includes('Node') ||
    //     message.includes('DOM')
    //   )) {
    //     console.warn('DOM error caught and suppressed:', message);
    //     return true; // Предотвращаем показ ошибки
    //   }
    //   if (originalErrorHandler) {
    //     return originalErrorHandler(message, source, lineno, colno, error);
    //   }
    // };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && typeof event.reason === 'string' && (
        event.reason.includes('removeChild') ||
        event.reason.includes('Node') ||
        event.reason.includes('DOM')
      )) {
        console.warn('DOM promise rejection caught and suppressed:', event.reason);
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Обработчик события element-drop для сохранения после drag & drop элементов
    const handleElementDrop = (event: CustomEvent) => {
      const eventPageId = event.detail?.pageId;
      if (eventPageId && eventPageId !== pageId) {
        console.log('🎯 [ElementDrop] Event from different page, ignoring:', { eventPageId, currentPageId: pageId });
        return;
      }
      
      console.log('🎯 [ElementDrop] ===== ELEMENT DROP EVENT RECEIVED =====');
      console.log('🎯 [ElementDrop] Event detail:', event.detail);
      console.log('🎯 [ElementDrop] Event type:', event.type);
      console.log('🎯 [ElementDrop] Event target:', event.target);
      
      // Логируем для тестирования cross-block операций
      logCrossBlockTest(TestResult.NOT_TESTED, 'Element drop event received', {
        eventType: event.type,
        hasDetail: !!event.detail,
        pageId: eventPageId,
        operation: 'element-drop'
      });

      const { elementId, targetBlockId, position } = event.detail;

      console.log('🎯 [ElementDrop] Parsed data:', {
        elementId,
        targetBlockId,
        position,
        elementIdType: typeof elementId,
        targetBlockIdType: typeof targetBlockId,
        positionType: typeof position
      });

      // Находим целевой блок
      const targetBlock = blocks.find(b => b.id === targetBlockId);
      console.log('🎯 [ElementDrop] Target block search:', {
        targetBlockId,
        blocksCount: blocks.length,
        blockIds: blocks.map(b => b.id),
        targetBlockFound: !!targetBlock,
        targetBlock: targetBlock ? {
          id: targetBlock.id,
          blockType: targetBlock.blockType,
          position: targetBlock.position
        } : null
      });

      if (!targetBlock) {
        console.warn('❌ [ElementDrop] Target block not found:', targetBlockId);
        return;
      }

      // Получаем ссылку на редактор блока
      const blockRef = blockRefs.get(targetBlockId);
      console.log('🎯 [ElementDrop] Block ref search:', {
        targetBlockId,
        blockRefExists: !!blockRef,
        hasEditor: !!blockRef?.editor,
        hasProvider: !!blockRef?.provider,
        editorReady: blockRef?.editor?.isEditable,
        providerStatus: blockRef?.provider?.status
      });

      if (!blockRef?.editor) {
        console.warn('❌ [ElementDrop] Block editor not found:', targetBlockId);
        return;
      }

      // Получаем текущее содержимое блока из редактора
      console.log('🎯 [ElementDrop] Getting editor content...');
      const editorContent = blockRef.editor.getJSON();
      console.log('🎯 [ElementDrop] Editor content retrieved:', {
        contentType: typeof editorContent,
        hasContent: !!editorContent,
        contentKeys: Object.keys(editorContent || {}),
        contentSize: JSON.stringify(editorContent).length
      });

      // Обновляем блок с новым содержимым
      const updatedBlock = {
        ...targetBlock,
        content: editorContent
      };

      console.log('🎯 [ElementDrop] Updated block created:', {
        blockId: updatedBlock.id,
        blockType: updatedBlock.blockType,
        position: updatedBlock.position,
        contentUpdated: true
      });

      // Обновляем массив блоков
      const updatedBlocks = blocks.map(block =>
        block.id === targetBlockId ? updatedBlock : block
      );

      console.log('🎯 [ElementDrop] Blocks array updated:', {
        totalBlocks: updatedBlocks.length,
        updatedBlockIndex: updatedBlocks.findIndex(b => b.id === targetBlockId),
        allBlockIds: updatedBlocks.map(b => b.id)
      });

      // Обновляем состояние
      setBlocks(updatedBlocks);

      // Отправляем на сервер
      const serverData = updatedBlocks.map(block => ({
        blockId: block.id,
        blockType: block.blockType,
        pageId: block.pageId,
        content: block.content
      }));

      console.log('🎯 [ElementDrop] Server data prepared:', {
        serverDataLength: serverData.length,
        targetBlockData: serverData.find(b => b.blockId === targetBlockId)
      });

      console.log('🎯 [ElementDrop] Saving blocks after element drop...');
      saveBlocksToServer(pageId, serverData);
      console.log('✅ [ElementDrop] ===== ELEMENT DROP COMPLETED =====');
      
      // Логируем успешное завершение
      logCrossBlockTest(TestResult.SUCCESS, 'Element drop completed successfully', {
        elementId,
        targetBlockId,
        position,
        blocksUpdated: updatedBlocks.length,
        operation: 'element-drop'
      });
    };

    // Обработчик для вставки одноэлементного блока в состав другого блока
    const handleSingleElementBlockInsert = (event: CustomEvent) => {
      console.log('🔄 [SingleElementBlockInsert] ===== SINGLE ELEMENT BLOCK INSERT EVENT =====');
      console.log('🔄 [SingleElementBlockInsert] Event detail:', event.detail);
      
      // Логируем для тестирования cross-block операций
      logCrossBlockTest(TestResult.NOT_TESTED, 'Single element block insert event received', {
        eventType: event.type,
        hasDetail: !!event.detail,
        operation: 'single-element-block-insert'
      });

      const { sourceBlockId, targetBlockId, elementId } = event.detail;

      // Находим исходный и целевой блоки
      const sourceBlock = blocks.find(b => b.id === sourceBlockId);
      const targetBlock = blocks.find(b => b.id === targetBlockId);

      if (!sourceBlock || !targetBlock) {
        console.warn('❌ [SingleElementBlockInsert] Source or target block not found:', { sourceBlockId, targetBlockId });
        return;
      }

      // Получаем ссылки на редакторы
      const sourceBlockRef = blockRefs.get(sourceBlockId);
      const targetBlockRef = blockRefs.get(targetBlockId);

      if (!sourceBlockRef?.editor || !targetBlockRef?.editor) {
        console.warn('❌ [SingleElementBlockInsert] Source or target editor not found:', {
          sourceEditor: !!sourceBlockRef?.editor,
          targetEditor: !!targetBlockRef?.editor
        });
        return;
      }

      // Извлекаем содержимое исходного блока
      const sourceContent = sourceBlockRef.editor.getJSON();
      console.log('🔄 [SingleElementBlockInsert] Source content:', sourceContent);

      // Определяем, что извлекать из исходного блока
      let elementToInsert = null;

      if (sourceContent && sourceContent.content && sourceContent.content.length > 0) {
        // Берем первый элемент (параграф или заголовок)
        elementToInsert = sourceContent.content[0];
      }

      if (!elementToInsert) {
        console.warn('❌ [SingleElementBlockInsert] No content to insert from source block');
        return;
      }

      console.log('🔄 [SingleElementBlockInsert] Element to insert:', elementToInsert);

      // Вставляем элемент в целевой блок
      try {
        const targetEditor = targetBlockRef.editor;

        // Получаем текущее содержимое целевого блока
        const targetContent = targetEditor.getJSON();

        // Создаем новое содержимое с добавленным элементом
        const newContent = {
          ...targetContent,
          content: [
            ...(targetContent.content || []),
            elementToInsert
          ]
        };

        // Обновляем целевой блок
        targetEditor.commands.setContent(newContent);

        // Удаляем исходный блок
        const updatedBlocks = blocks.filter(b => b.id !== sourceBlockId);

        // Обновляем позиции оставшихся блоков
        const finalBlocks = updatedBlocks.map((block, index) => ({
          ...block,
          position: index,
          content: block.id === targetBlockId ? newContent : block.content
        }));

        console.log('🔄 [SingleElementBlockInsert] Updating blocks state...');
        setBlocks(finalBlocks);

        // Сохраняем на сервер
        const serverData = finalBlocks.map(block => ({
          blockId: block.id,
          blockType: block.blockType,
          pageId: block.pageId,
          content: block.content
        }));

        console.log('🔄 [SingleElementBlockInsert] Saving to server...');
        saveBlocksToServer(pageId, serverData);

        console.log('✅ [SingleElementBlockInsert] ===== SINGLE ELEMENT BLOCK INSERT COMPLETED =====');
        
        // Логируем успешное завершение
        logCrossBlockTest(TestResult.SUCCESS, 'Single element block insert completed successfully', {
          sourceBlockId,
          targetBlockId,
          elementId,
          blocksUpdated: finalBlocks.length,
          operation: 'single-element-block-insert'
        });
      } catch (error) {
        console.error('❌ [SingleElementBlockInsert] Error inserting element:', error);
      }
    };

    document.addEventListener('element-drop', handleElementDrop as EventListener);
    document.addEventListener('single-element-block-insert', handleSingleElementBlockInsert as EventListener);

    // 🟣 STEP 5: Исправленный обработчик cross-block перемещения элементов через Tiptap с ожиданием редакторов
    const handleCrossBlockElementMove = (event: CustomEvent<CrossBlockMoveOperation>) => {
      const eventPageId = event.detail?.pageId;
      if (eventPageId && eventPageId !== pageId) {
        console.log('🔄 [CrossBlockMove] Event from different page, ignoring:', { eventPageId, currentPageId: pageId });
        return;
      }
      
      console.log('🔄 [CrossBlockMove] ===== CROSS-BLOCK ELEMENT MOVE EVENT =====');
      console.log('🔄 [CrossBlockMove] Event detail:', event.detail);
      console.log('🔄 [CrossBlockMove] Event type:', event.type);
      console.log('🔄 [CrossBlockMove] Event target:', event.target);
      
      // Логируем для тестирования cross-block операций
      logCrossBlockTest(TestResult.NOT_TESTED, 'Cross-block element move event received', {
        eventType: event.type,
        hasDetail: !!event.detail,
        pageId: eventPageId,
        operation: 'cross-block-element-move'
      });
      console.log('🔄 [CrossBlockMove] Current blockRefs state at move start:', {
        size: blockRefs.size,
        keys: Array.from(blockRefs.keys()),
        isReady
      });
      const detail = event.detail as any;

      // Проверяем обязательные поля
      if (!detail.sourceBlockId || !detail.targetBlockId) {
        console.error('[PageEditor] Invalid cross-block move data - missing block IDs:', detail);
        return;
      }

      // Проверяем наличие elementData.id
      const elementId = detail.elementData?.id || detail.elementId;
      if (!elementId) {
        console.error('[PageEditor] Invalid cross-block move data - missing element ID:', detail);
        return;
      }

      // Проверяем готовность редакторов перед началом операции
      if (!isReady) {
        console.warn('[PageEditor] Editors not ready yet, running detailed diagnostics...');
        const detailedReady = logBlockEditorsState(blockRefs);

        if (!detailedReady) {
          console.warn('[PageEditor] Detailed check shows editors still not ready, aborting cross-block move to prevent recursion...');
          return;
        } else {
          console.log('[PageEditor] Detailed check shows editors are ready, proceeding...');
        }
      }

      // Функция для выполнения перемещения с проверкой готовности редакторов
      const executeMove = (retryCount = 0) => {
        const maxRetries = 30; // Максимум 1.5 секунды ожидания (30 * 50ms)

        // Получаем ссылки на редакторы блоков
        const sourceBlockRef = blockRefs.get(detail.sourceBlockId);
        const targetBlockRef = blockRefs.get(detail.targetBlockId);

        console.log(`[PageEditor] Checking editor readiness (attempt ${retryCount + 1}/${maxRetries}):`, {
          sourceBlockId: detail.sourceBlockId,
          targetBlockId: detail.targetBlockId,
          sourceEditor: !!sourceBlockRef?.current?.editor,
          targetEditor: !!targetBlockRef?.current?.editor,
          sourceEditorReady: sourceBlockRef?.current?.editor?.isEditable,
          targetEditorReady: targetBlockRef?.current?.editor?.isEditable,
          sourceProviderStatus: sourceBlockRef?.current?.provider?.status,
          targetProviderStatus: targetBlockRef?.current?.provider?.status,
          availableEditors: Array.from(blockRefs.keys()),
          blockRefsSize: blockRefs.size
        });

        // Детальная диагностика для source и target блоков
        if (sourceBlockRef?.current) {
          console.log(`[PageEditor] Source block ${detail.sourceBlockId} details:`, {
            hasEditor: !!sourceBlockRef.current.editor,
            editorIsEditable: sourceBlockRef.current.editor?.isEditable,
            editorIsDestroyed: sourceBlockRef.current.editor?.isDestroyed,
            hasProvider: !!sourceBlockRef.current.provider,
            providerStatus: sourceBlockRef.current.provider?.status,
            providerConnected: sourceBlockRef.current.provider?.isConnected
          });
        }

        if (targetBlockRef?.current) {
          console.log(`[PageEditor] Target block ${detail.targetBlockId} details:`, {
            hasEditor: !!targetBlockRef.current.editor,
            editorIsEditable: targetBlockRef.current.editor?.isEditable,
            editorIsDestroyed: targetBlockRef.current.editor?.isDestroyed,
            hasProvider: !!targetBlockRef.current.provider,
            providerStatus: targetBlockRef.current.provider?.status,
            providerConnected: targetBlockRef.current.provider?.isConnected
          });
        }

        if (!sourceBlockRef?.current?.editor || !targetBlockRef?.current?.editor) {
          if (retryCount < maxRetries) {
            console.log(`[PageEditor] Editors not ready, retrying... (${retryCount + 1}/${maxRetries})`);

            // Увеличиваем интервал с каждой попыткой для более стабильной работы
            const delay = Math.min(50 + retryCount * 10, 200); // От 50ms до 200ms
            setTimeout(() => {
              // Добавляем защиту от рекурсии
              if (retryCount < maxRetries) {
                executeMove(retryCount + 1);
              }
            }, delay);
            return;
          } else {
            console.error('[PageEditor] Editors not ready after maximum retries:', {
              sourceBlockId: detail.sourceBlockId,
              targetBlockId: detail.targetBlockId,
              sourceEditor: !!sourceBlockRef?.current?.editor,
              targetEditor: !!targetBlockRef?.current?.editor,
              availableEditors: Array.from(blockRefs.keys()),
              blockRefsSize: blockRefs.size,
              allBlockRefs: Array.from(blockRefs.entries()).map(([id, ref]) => ({
                id,
                hasEditor: !!ref?.current?.editor,
                editorReady: ref?.current?.editor?.isEditable
              }))
            });
            return;
          }
        }

        console.log('🔄 [CrossBlockMove] Using Tiptap editors for cross-block move:', {
          sourceBlockId: detail.sourceBlockId,
          targetBlockId: detail.targetBlockId,
          elementId,
          targetPosition: detail.targetPosition || 'after',
          beforeElementId: detail.beforeElementId
        });

        // Определяем, нужно ли перемещать между разными редакторами или внутри одного
        const isSameEditor = detail.sourceBlockId === detail.targetBlockId;
        console.log('🔄 [CrossBlockMove] Move type:', isSameEditor ? 'WITHIN_SAME_EDITOR' : 'BETWEEN_DIFFERENT_EDITORS');

        let moveSuccess = false;

        if (isSameEditor) {
          // Перемещение внутри одного редактора
          console.log('🔄 [CrossBlockMove] Executing within-editor move...');
          moveSuccess = moveElementWithinTiptapEditor(
            sourceBlockRef.current.editor,
            elementId,
            detail.targetPosition || 'after',
            detail.beforeElementId
          );
        } else {
          // Перемещение между разными редакторами
          console.log('🔄 [CrossBlockMove] Executing between-editors move...');
          const tiptapOperation: TiptapMoveOperation = {
            sourceEditor: sourceBlockRef.current.editor,
            targetEditor: targetBlockRef.current.editor,
            elementId,
            targetPosition: detail.targetPosition || 'after',
            beforeElementId: detail.beforeElementId
          };

          console.log('🔄 [CrossBlockMove] Tiptap operation prepared:', {
            elementId: tiptapOperation.elementId,
            targetPosition: tiptapOperation.targetPosition,
            beforeElementId: tiptapOperation.beforeElementId,
            sourceEditorExists: !!tiptapOperation.sourceEditor,
            targetEditorExists: !!tiptapOperation.targetEditor
          });

          moveSuccess = moveElementBetweenTiptapEditors(tiptapOperation);
        }

        if (moveSuccess) {
          console.log('✅ [CrossBlockMove] Tiptap cross-block element move completed successfully');

          // Обновляем состояние блоков для синхронизации с сервером
          console.log('🔄 [CrossBlockMove] Updating blocks state for server sync...');
          const currentBlocks = blocksRef.current;
          const updatedBlocks = currentBlocks.map(block => {
            const blockRef = blockRefs.get(block.id);
            if (blockRef?.editor) {
              // Получаем актуальное содержимое из редактора
              const editorContent = blockRef.editor.getJSON();
              console.log('🔄 [CrossBlockMove] Updated block content:', {
                blockId: block.id,
                contentType: typeof editorContent,
                contentSize: JSON.stringify(editorContent).length
              });
              return {
                ...block,
                content: editorContent
              };
            }
            return block;
          });

          console.log('🔄 [CrossBlockMove] Setting updated blocks state...');
          setBlocks(updatedBlocks);

          // Сохраняем на сервер
          const serverData = updatedBlocks.map(block => ({
            blockId: block.id,
            blockType: block.blockType,
            pageId: block.pageId,
            content: block.content,
          }));

          console.log('🔄 [CrossBlockMove] Saving to server:', {
            serverDataLength: serverData.length,
            sourceBlockData: serverData.find(b => b.blockId === detail.sourceBlockId),
            targetBlockData: serverData.find(b => b.blockId === detail.targetBlockId)
          });

          saveBlocksToServer(pageId, serverData);

          // Очищаем координатор
          console.log('🔄 [CrossBlockMove] Cleaning up DnD coordinator...');
          dndCoordinator.forceCleanup();

          console.log('✅ [CrossBlockMove] ===== CROSS-BLOCK ELEMENT MOVE COMPLETED =====');
          
          // Логируем успешное завершение
          logCrossBlockTest(TestResult.SUCCESS, 'Cross-block element move completed successfully', {
            sourceBlockId: detail.sourceBlockId,
            targetBlockId: detail.targetBlockId,
            elementId,
            targetPosition: detail.targetPosition || 'after',
            blocksUpdated: updatedBlocks.length,
            operation: 'cross-block-element-move'
          });
        } else {
          console.warn('❌ [CrossBlockMove] Tiptap cross-block element move failed');
          console.log('❌ [CrossBlockMove] ===== CROSS-BLOCK ELEMENT MOVE FAILED =====');
          
          // Логируем неудачное завершение
          logCrossBlockTest(TestResult.FAILED, 'Cross-block element move failed', {
            sourceBlockId: detail.sourceBlockId,
            targetBlockId: detail.targetBlockId,
            elementId,
            targetPosition: detail.targetPosition || 'after',
            operation: 'cross-block-element-move'
          });
        }
      };

      // Запускаем выполнение с ожиданием готовности редакторов
      executeMove();
    };

    document.addEventListener('cross-block-element-move', handleCrossBlockElementMove as EventListener);

    // Обработчик cross-block перемещения блоков
    const handleCrossBlockBlockMove = (event: CustomEvent) => {
      const eventPageId = event.detail?.pageId;
      if (eventPageId && eventPageId !== pageId) {
        console.log('🔄 [CrossBlockBlockMove] Event from different page, ignoring:', { eventPageId, currentPageId: pageId });
        return;
      }
      
      console.log('[PageEditor] Cross-block block move event received:', event.detail);

      const { sourceBlockId, targetBlockId, blockData } = event.detail as any;

      // Используем актуальное состояние через ref, чтобы избежать устаревших ссылок
      const currentBlocks = blocksRef.current as any[];

      // Находим исходный и целевой блоки
      const sourceBlock = currentBlocks.find(b => b.id === sourceBlockId);
      const targetBlock = currentBlocks.find(b => b.id === targetBlockId);

      if (!sourceBlock || !targetBlock) {
        console.warn('[PageEditor] Source or target block not found:', { sourceBlockId, targetBlockId, available: currentBlocks.map(b => b.id) });
        return;
      }

      console.log('[PageEditor] Moving block:', {
        from: sourceBlock.position,
        to: targetBlock.position,
        blockId: sourceBlock.id
      });

      // Создаем новый массив блоков без исходного блока
      const newBlocks = currentBlocks.filter(b => b.id !== sourceBlockId);

      // Находим позицию для вставки
      const targetIndex = newBlocks.findIndex(b => b.id === targetBlockId);
      const insertIndex = targetIndex + 1; // Вставляем после целевого блока (можно учитывать targetPosition при необходимости)

      // Вставляем блок в новую позицию
      newBlocks.splice(insertIndex, 0, sourceBlock);

      // Обновляем позиции всех блоков
      const updatedBlocks = newBlocks.map((block, index) => ({
        ...block,
        position: index,
        content: {
          ...block.content,
          attrs: {
            ...block.content?.attrs,
            position: index
          }
        }
      }));

      console.log('[PageEditor] Updated blocks after cross-block move:', updatedBlocks.map(b => ({ id: b.id, position: b.position })));

      // Обновляем состояние
      setBlocks(updatedBlocks);

      // Отправляем на сервер
      const serverData = updatedBlocks.map(block => ({
        blockId: block.id,
        blockType: block.blockType,
        pageId: block.pageId,
        content: block.content
      }));

      console.log('[PageEditor] Saving blocks after cross-block block move:', serverData);
      saveBlocksToServer(pageId, serverData);
    };

    document.addEventListener('cross-block-block-move', handleCrossBlockBlockMove as EventListener);

    // Обработчик автоматического перетаскивания элемента в новый блок
    const handleAutoDragElementToBlock = (event: CustomEvent) => {
      const eventPageId = event.detail?.pageId;
      if (eventPageId && eventPageId !== pageId) {
        console.log('🔄 [AutoDragElementToBlock] Event from different page, ignoring:', { eventPageId, currentPageId: pageId });
        return;
      }
      
      console.log('🔄 [AutoDragElementToBlock] ===== AUTO DRAG ELEMENT TO BLOCK EVENT =====');
      console.log('🔄 [AutoDragElementToBlock] Event detail:', event.detail);

      const { sourceBlockId, targetBlockId, elementId } = event.detail as any;

      // Получаем ссылки на редакторы
      const sourceEditor = blockRefs.get(sourceBlockId)?.editor;
      const targetEditor = blockRefs.get(targetBlockId)?.editor;

      if (!sourceEditor || !targetEditor) {
        console.warn('❌ [AutoDragElementToBlock] Source or target editor not found:', {
          sourceBlockId,
          targetBlockId,
          hasSourceEditor: !!sourceEditor,
          hasTargetEditor: !!targetEditor
        });
        return;
      }

      try {
        // Выполняем перемещение элемента между редакторами
        const moveResult = handleCrossBlockMove(blocksRef.current, {
          sourceBlockId,
          targetBlockId,
          elementData: { 
            id: elementId,
            type: 'listItem' as const,
            content: null,
            position: 0,
            parentBlockId: sourceBlockId
          },
          targetPosition: 'inside'
        });

        if (moveResult.success) {
          console.log('✅ [AutoDragElementToBlock] Element moved successfully');
          
          // Обновляем состояние блоков
          const updatedBlocks = blocksRef.current.map(block => {
            if (block.id === sourceBlockId || block.id === targetBlockId) {
              return {
                ...block,
                content: block.editor?.getJSON()?.content || block.content
              };
            }
            return block;
          });

          // Очищаем пустые параграфы
          const cleanedBlocks = cleanupBlocksContent(updatedBlocks);

          setBlocks(cleanedBlocks);
          saveBlocksToServer(pageId, cleanedBlocks);
        } else {
          console.error('❌ [AutoDragElementToBlock] Failed to move element');
        }
      } catch (error) {
        console.error('❌ [AutoDragElementToBlock] Error during auto drag:', error);
      }
    };

    document.addEventListener('auto-drag-element-to-block', handleAutoDragElementToBlock as EventListener);

    return () => {
      // console.log('🧹 [DndEvents] Cleaning up event handlers for page:', pageId);
      if ((window as any).__isCrossBlockMoveInProgress) {
        (window as any).__isCrossBlockMoveInProgress = false;
        // console.log('🧹 [DndEvents] Cleared global cross-block move flag');
      }
      if ((window as any).__activeCrossBlockOperations) {
        (window as any).__activeCrossBlockOperations.clear();
        // console.log('🧹 [DndEvents] Cleared active cross-block operations');
      }
      // Убрали восстановление originalErrorHandler
      // window.onerror = originalErrorHandler;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      document.removeEventListener('element-drop', handleElementDrop as EventListener);
      document.removeEventListener('cross-block-element-move', handleCrossBlockElementMove as EventListener);
      document.removeEventListener('cross-block-block-move', handleCrossBlockBlockMove as EventListener);
      document.removeEventListener('single-element-block-insert', handleSingleElementBlockInsert as EventListener);
      document.removeEventListener('auto-drag-element-to-block', handleAutoDragElementToBlock as EventListener);
      // console.log('✅ [DndEvents] Event handlers cleaned up for page:', pageId);
    };
  }, [blocks, blocksRef, blockRefs, isReady, setBlocks, saveBlocksToServer, pageId]);

  // Убрали избыточное логирование для оптимизации производительности
  // useEffect(() => {
  //   const currentBlockIds = blocks.map(b => b.id).sort().join(',');
  //   const currentBlockRefIds = Array.from(blockRefs.keys()).sort().join(',');
  //   // ... логирование отключено для оптимизации
  // }, [blocks, blockRefs, isReady]);

  // Функция для детальной диагностики состояния редакторов
  const logBlockEditorsState = useCallback((blockRefs: Map<string, any>) => {
    console.log('[Diagnostics] 🔍 Checking blockRefs state...');
    if (!blockRefs || blockRefs.size === 0) {
      console.log('[Diagnostics] ❌ blockRefs is empty');
      return false;
    }

    let allReady = true;
    const diagnostics = [];

    blockRefs.forEach((ref, blockId) => {
      const editor = ref?.current?.editor;
      const provider = ref?.current?.provider;

      const isEditorReady = !!editor && editor.isEditable && !editor.isDestroyed;
      const isProviderReady = !!provider && (provider.status === 'connected' || provider.status === 'disconnected' || !provider.status);
      const isBlockReady = isEditorReady && isProviderReady;

      if (!isBlockReady) allReady = false;

      const blockDiagnostics = {
        blockId,
        hasRef: !!ref,
        hasCurrent: !!ref?.current,
        hasEditor: !!editor,
        hasProvider: !!provider,
        editorReady: isEditorReady,
        editorIsEditable: editor?.isEditable,
        editorIsDestroyed: editor?.isDestroyed,
        editorHasView: !!editor?.view,
        editorHasDOM: !!editor?.view?.dom,
        providerReady: isProviderReady,
        providerStatus: provider?.status,
        providerConnected: provider?.isConnected,
        providerExists: !!provider,
        blockReady: isBlockReady
      };

      diagnostics.push(blockDiagnostics);

      console.log(`[Diagnostics] 📊 Block ${blockId}:`, blockDiagnostics);
    });

    console.log('[Diagnostics] 🎯 Overall state:', {
      totalBlocks: blockRefs.size,
      allReady,
      readyBlocks: diagnostics.filter(d => d.blockReady).length,
      notReadyBlocks: diagnostics.filter(d => !d.blockReady).length,
      notReadyReasons: diagnostics
        .filter(d => !d.blockReady)
        .map(d => ({
          blockId: d.blockId,
          reasons: [
            !d.hasEditor && 'no editor',
            d.hasEditor && !d.editorIsEditable && 'editor not editable',
            d.hasEditor && d.editorIsDestroyed && 'editor destroyed',
            !d.hasProvider && 'no provider',
            d.hasProvider && d.providerStatus !== 'connected' && d.providerStatus !== 'disconnected' && `provider status: ${d.providerStatus}`
          ].filter(Boolean)
        }))
    });

    return allReady;
  }, []);

  return {
    logBlockEditorsState
  };
};

