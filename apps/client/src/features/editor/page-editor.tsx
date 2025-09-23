import "@/features/editor/styles/index.css";
import React, { useEffect } from "react";
import { EnhancedBlockHandle } from "@/features/editor/components/drag-handle/enhanced-block-handle";
import { EnhancedDndProviderV2 } from "@/features/editor/components/drag-handle/enhanced-dnd-provider-v2";
import { useDragAndDrop } from "@/features/editor/hooks/use-drag-and-drop";
import { BlockWrapper } from "@/features/editor/components/block-wrapper";
// import { BlockWrapper as DragBlockWrapper } from "@/features/editor/components/drag-handle/block-wrapper"; // Убрали дублирование
import { BlockDropZone } from "@/features/editor/components/drag-handle/block-drop-zone";
import { useBlockManagement } from "@/features/editor/hooks/use-block-management";
import { useEditorDiagnostics } from "@/features/editor/hooks/use-editor-diagnostics";
import { useDndEvents } from "@/features/editor/hooks/use-dnd-events";
import { saveBlocksToServer, startPeriodicSave, stopPeriodicSave, forceSaveBlocks } from "@/features/editor/utils/block-utils";
import { cleanupBlocksContent } from "@/features/editor/utils/cleanup-empty-paragraphs";
import { addElementToBlock, handleCrossBlockElementMove } from "@/features/editor/utils/cross-block-element-utils";

// Объявляем глобальные переменные для TypeScript
declare global {
  interface Window {
    __currentBlockId?: string;
    __originalDragBlockId?: string;
  }
}

// Типы для DnD операций
type CrossBlockMoveOperation = {
  sourceBlockId: string;
  targetBlockId: string;
  elementData: any;
  targetPosition: "before" | "after" | "inside";
};



export default function PageEditor({ pageId, editable, content, syncPageOriginId }) {
  // Используем хук для управления блоками
  const blockManagement = useBlockManagement({ pageId, editable });

  const {
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
    loadBlocks,
    handleBlockCreated,
    handleBlockDeleted,
    focusBlock,
    focusBlockWithRetry,
    deleteBlockSafely,
    findBlockElement,
    navigateUp,
    navigateDown,
    navigateToFirst,
    navigateToLast,
    getNextBlock,
    getPreviousBlock,
    getFirstBlock,
    getLastBlock,
    createBlockBetween,
    createBlockAtEnd,
  } = blockManagement;

  // Используем хук для диагностики редакторов - логи отключены
  const editorDiagnostics = useEditorDiagnostics({
    blocks,
    blockRefs: blockRefs.current,
    isReady,
    enableLogging: false
  });

  // Настраиваем глобальные функции отладки
  useEffect(() => {
    editorDiagnostics.setupGlobalDebugFunctions(blocksRef, blockRefs.current);
    
  }, [editorDiagnostics, blocksRef, blockRefs]);

  // Обработчики событий для DnD системы
  useEffect(() => {
    console.log('[PageEditor] Setting up DnD event listeners');
    
    // Обработчик создания нового элемента в cross-block операции
    const handleCrossBlockCreateElement = (event: CustomEvent) => {
      console.log('[PageEditor] Cross-block create element event received:', event.detail);
      
      const { sourceBlockId, targetBlockId, elementData, targetPosition } = event.detail;
      
      // Создаем операцию для добавления элемента в целевой блок
      const operation: CrossBlockMoveOperation = {
        sourceBlockId,
        targetBlockId,
        elementData,
        targetPosition
      };
      
      // Добавляем элемент в целевой блок (без удаления из исходного, так как это синтетический элемент)
      console.log('[PageEditor] Current blocksRef.current:', blocksRef.current.map(b => ({ id: b.id, blockType: b.blockType })));
      const targetBlock = blocksRef.current.find(b => b.id === targetBlockId);
      console.log('[PageEditor] Found target block:', targetBlock ? { id: targetBlock.id, blockType: targetBlock.blockType } : null);
      if (targetBlock) {
        const updatedTargetBlock = addElementToBlock(targetBlock, elementData, targetPosition);
        const updatedBlocks = blocksRef.current.map(block => 
          block.id === targetBlockId ? updatedTargetBlock : block
        );
        console.log('[PageEditor] Updated blocks after adding element:', updatedBlocks.map(b => ({ id: b.id, blockType: b.blockType })));
        
        // Обновляем состояние
        blocksRef.current = updatedBlocks;
        setBlocks(() => {
          console.log('[PageEditor] setBlocks called with updatedBlocks:', updatedBlocks.length, 'blocks');
          return JSON.parse(JSON.stringify(updatedBlocks));
        });
        
        // Дополнительное обновление через requestAnimationFrame для гарантии рендера
        requestAnimationFrame(() => {
          console.log('[PageEditor] 🔄 RequestAnimationFrame update after cross-block create element');
          setBlocks(prevBlocks => {
            console.log('[PageEditor] RequestAnimationFrame: prevBlocks length:', prevBlocks.length);
            if (prevBlocks.length === 0 && blocksRef.current.length > 0) {
              console.log('[PageEditor] RequestAnimationFrame: Force updating from blocksRef.current');
              return JSON.parse(JSON.stringify(blocksRef.current));
            }
            return prevBlocks;
          });
          
          // Убрали setRenderKey чтобы избежать перерендера
          
          // Принудительно обновляем все ProseMirror редакторы
          setTimeout(() => {
            console.log('[PageEditor] 🔄 Force updating ProseMirror editors');
            const editors = document.querySelectorAll('.ProseMirror');
            console.log('[PageEditor] Found editors to update:', editors.length);
            
            editors.forEach((editor, index) => {
              console.log('[PageEditor] Updating editor', index, editor);
              
              // Пытаемся найти blockId для этого редактора
              const blockId = editor.getAttribute('data-block-id');
              if (blockId) {
                console.log('[PageEditor] Found block ID for editor:', blockId);
                
                // Находим обновленный блок
                const updatedBlock = blocksRef.current.find(b => b.id === blockId);
                if (updatedBlock) {
                  console.log('[PageEditor] Found updated block for editor:', blockId);
                  
                  try {
                    // Пытаемся получить ProseMirror view
                    const view = (editor as any).__view || 
                                (editor as any).pmView || 
                                (editor as any).getAttribute('data-pm-view') ||
                                (editor as any).__tiptapEditor?.view;
                    
                    if (view) {
                      console.log('[PageEditor] Found ProseMirror view, dispatching transaction');
                      
                      // Создаем транзакцию для принудительного обновления
                      const tr = view.state.tr.setMeta('forceUpdate', true);
                      const newState = view.state.apply(tr);
                      view.dispatch(newState);
                      
                      // Также триггерим события
                      editor.dispatchEvent(new Event('input', { bubbles: true }));
                      editor.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                      console.log('[PageEditor] No ProseMirror view found, using React re-render only');
                      
                      // Fallback: только события без DOM манипуляций
                      editor.dispatchEvent(new Event('input', { bubbles: true }));
                      editor.dispatchEvent(new Event('change', { bubbles: true }));
                      editor.dispatchEvent(new Event('blur', { bubbles: true }));
                      editor.dispatchEvent(new Event('focus', { bubbles: true }));
                    }
                  } catch (error) {
                    console.warn('[PageEditor] Error updating ProseMirror view:', error);
                  }
                }
              }
            });
          }, 100);
        });
      } else {
        console.warn('[PageEditor] Target block not found:', targetBlockId);
      }
    };

    // Обработчик удаления текста из блока
    const handleRemoveTextFromBlock = (event: CustomEvent) => {
      console.log('[PageEditor] Remove text from block event received:', event.detail);
      
      const { blockId, textToRemove } = event.detail;
      
      const sourceBlock = blocksRef.current.find(b => b.id === blockId);
      if (sourceBlock) {
        console.log('[PageEditor] Found source block for text removal:', sourceBlock.id);
        
        // Рекурсивная функция для удаления текста из контента
        const removeTextFromContent = (content: any): any => {
          if (!content) return content;
          
          if (Array.isArray(content)) {
            return content
              .map(item => removeTextFromContent(item))
              .filter(item => {
                // Удаляем пустые параграфы, task items и task lists
                if (item && typeof item === 'object') {
                  if (item.type === 'paragraph' && (!item.content || item.content.length === 0)) {
                    return false;
                  }
                  if (item.type === 'taskItem' && (!item.content || item.content.length === 0)) {
                    return false;
                  }
                  if (item.type === 'taskList' && (!item.content || item.content.length === 0)) {
                    return false;
                  }
                }
                return true;
              });
          }
          
          if (typeof content === 'object' && content !== null) {
            if (content.text && content.text.includes(textToRemove)) {
              // Удаляем текст из текстового узла
              const newText = content.text.replace(textToRemove, '').trim();
              if (newText === '') {
                return null; // Удаляем пустой текстовый узел
              }
              return { ...content, text: newText };
            }
            
            if (content.content) {
              const newContent = removeTextFromContent(content.content);
              if (newContent === null || (Array.isArray(newContent) && newContent.length === 0)) {
                return null; // Удаляем узел с пустым контентом
              }
              return { ...content, content: newContent };
            }
          }
          
          return content;
        };
        
        // Удаляем текст из блока
        const updatedContent = removeTextFromContent(sourceBlock.content);
        const updatedBlocks = blocksRef.current.map(block => 
          block.id === blockId 
            ? { ...block, content: updatedContent }
            : block
        );
        
        console.log('[PageEditor] Updated blocks after text removal:', updatedBlocks.map(b => ({ id: b.id, blockType: b.blockType })));
        
        // Обновляем состояние
        blocksRef.current = updatedBlocks;
        setBlocks(() => {
          console.log('[PageEditor] setBlocks called for text removal with updatedBlocks:', updatedBlocks.length, 'blocks');
          return JSON.parse(JSON.stringify(updatedBlocks));
        });
        
        // Дополнительное обновление через requestAnimationFrame для гарантии рендера
        requestAnimationFrame(() => {
          console.log('[PageEditor] 🔄 RequestAnimationFrame update after text removal');
          setBlocks(prevBlocks => {
            console.log('[PageEditor] RequestAnimationFrame: prevBlocks length:', prevBlocks.length);
            if (prevBlocks.length === 0 && blocksRef.current.length > 0) {
              console.log('[PageEditor] RequestAnimationFrame: Force updating from blocksRef.current');
              return JSON.parse(JSON.stringify(blocksRef.current));
            }
            return prevBlocks;
          });
          
          // Убрали setRenderKey чтобы избежать перерендера
          
          // Принудительно обновляем все ProseMirror редакторы
          setTimeout(() => {
            console.log('[PageEditor] 🔄 Force updating ProseMirror editors after text removal');
            const editors = document.querySelectorAll('.ProseMirror');
            console.log('[PageEditor] Found editors to update:', editors.length);
            
            editors.forEach((editor, index) => {
              console.log('[PageEditor] Updating editor', index, editor);
              
              // Пытаемся найти blockId для этого редактора
              const blockId = editor.getAttribute('data-block-id');
              if (blockId) {
                console.log('[PageEditor] Found block ID for editor:', blockId);
                
                // Находим обновленный блок
                const updatedBlock = blocksRef.current.find(b => b.id === blockId);
                if (updatedBlock) {
                  console.log('[PageEditor] Found updated block for editor:', blockId);
                  
                  try {
                    // Пытаемся получить ProseMirror view
                    const view = (editor as any).__view || 
                                (editor as any).pmView || 
                                (editor as any).getAttribute('data-pm-view') ||
                                (editor as any).__tiptapEditor?.view;
                    
                    if (view) {
                      console.log('[PageEditor] Found ProseMirror view, dispatching transaction');
                      
                      // Создаем транзакцию для принудительного обновления
                      const tr = view.state.tr.setMeta('forceUpdate', true);
                      const newState = view.state.apply(tr);
                      view.dispatch(newState);
                      
                      // Также триггерим события
                      editor.dispatchEvent(new Event('input', { bubbles: true }));
                      editor.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                      console.log('[PageEditor] No ProseMirror view found, using React re-render only');
                      
                      // Fallback: только события без DOM манипуляций
                      editor.dispatchEvent(new Event('input', { bubbles: true }));
                      editor.dispatchEvent(new Event('change', { bubbles: true }));
                      editor.dispatchEvent(new Event('blur', { bubbles: true }));
                      editor.dispatchEvent(new Event('focus', { bubbles: true }));
                    }
                  } catch (error) {
                    console.warn('[PageEditor] Error updating ProseMirror view:', error);
                  }
                }
              }
            });
          }, 100);
        });
      } else {
        console.warn('[PageEditor] Source block not found for text removal:', blockId);
      }
    };

    // Убрали дублирующий обработчик cross-block перемещения элементов
    // Обработка теперь происходит только в use-dnd-events.ts

    // Добавляем обработчики событий
    document.addEventListener('cross-block-create-element', handleCrossBlockCreateElement as EventListener);
    document.addEventListener('remove-text-from-block', handleRemoveTextFromBlock as EventListener);
    // Убрали дублирующий обработчик cross-block-element-move

    // Cleanup
    return () => {
      document.removeEventListener('cross-block-create-element', handleCrossBlockCreateElement as EventListener);
      document.removeEventListener('remove-text-from-block', handleRemoveTextFromBlock as EventListener);
      // Убрали cleanup для дублирующего обработчика cross-block-element-move
    };
  }, []);

  // Запускаем периодическое сохранение каждые 3 секунды
  useEffect(() => {
    if (isInitialized && blocks.length > 0) {
      console.log('🔄 [PageEditor] Starting periodic save for pageId:', pageId);
      
      // Функция для получения текущих блоков в формате для сервера
      const getBlocksForSave = () => {
        console.log('🔄 [getBlocksForSave] Getting current blocks from editors...', {
          blocksCount: blocks.length,
          blockRefsCount: blockRefs.current.size
        });
        
        return blocks.map((block, index) => {
          // Получаем актуальное содержимое из редактора
          const blockRef = blockRefs.current.get(block.id);
          let currentContent = block.content;
          
          console.log('🔍 [getBlocksForSave] Processing block:', {
            index,
            blockId: block.id,
            hasBlockRef: !!blockRef,
            hasEditor: !!blockRef?.editor,
            originalContent: JSON.stringify(block.content).substring(0, 100) + '...'
          });
          
          if (blockRef?.editor) {
            try {
              const editorContent = blockRef.editor.getJSON();
              currentContent = editorContent;
              console.log('📝 [getBlocksForSave] Got content from editor for block:', {
                blockId: block.id,
                editorContent: JSON.stringify(editorContent).substring(0, 100) + '...',
                contentChanged: JSON.stringify(block.content) !== JSON.stringify(editorContent)
              });
            } catch (error) {
              console.warn('⚠️ [getBlocksForSave] Error getting content from editor:', error);
          }
        } else {
            console.log('⚠️ [getBlocksForSave] No editor found for block:', block.id);
          }
          
          const result = {
            blockId: block.id,
            blockType: block.blockType,
            pageId: block.pageId,
            content: currentContent,
            hasAccess: block.hasAccess,
            userPermission: block.userPermission
          };
          
          console.log('📦 [getBlocksForSave] Final block data:', {
            blockId: result.blockId,
            blockType: result.blockType,
            contentPreview: JSON.stringify(result.content).substring(0, 100) + '...'
          });
          
          return result;
        });
      };

      startPeriodicSave(pageId, getBlocksForSave);

      // Добавляем глобальные функции для тестирования
      (window as any).forceSavePage = async () => {
        console.log('🔄 [PageEditor] Force save triggered from console');
        return await forceSaveBlocks(pageId, getBlocksForSave);
      };

      (window as any).debugBlocks = () => {
        console.log('🔍 [PageEditor] Debug blocks data:');
        const currentBlocks = getBlocksForSave();
        console.log('Current blocks:', currentBlocks);
        
        // Показываем содержимое каждого блока
        currentBlocks.forEach((block, index) => {
          console.log(`Block ${index}:`, {
            blockId: block.blockId,
            blockType: block.blockType,
            content: block.content
          });
        });
        
        return currentBlocks;
      };

      // Очистка при размонтировании
    return () => {
        console.log('⏹️ [PageEditor] Stopping periodic save for pageId:', pageId);
        stopPeriodicSave(pageId);
        delete (window as any).forceSavePage;
        delete (window as any).debugBlocks;
      };
    }
  }, [isInitialized, blocks, pageId]);

    // Функция для создания нового блока из элемента
  const handleCreateBlockFromElement = (sourceBlockId: string, elementId: string, position: 'before' | 'after', targetBlockId: string) => {
    // Находим исходный блок
    const sourceBlock = blocks.find(b => b.id === sourceBlockId);
    if (!sourceBlock) {
      return;
    }

    // Определяем тип блока на основе исходного блока
    const sourceBlockType = sourceBlock.blockType || 'paragraph';
    const isListBlock = sourceBlockType.includes('list') || sourceBlockType.includes('task');
    
    // Создаем новый блок
          const newBlock = {
      id: window.crypto.randomUUID(),
      pageId: pageId,
      blockType: isListBlock ? sourceBlockType : 'paragraph',
      position: position === 'before' ? sourceBlock.position : sourceBlock.position + 1,
      content: isListBlock ? {
              type: 'doc',
              content: [
                {
            type: sourceBlockType,
                  attrs: {
              position: position === 'before' ? sourceBlock.position : sourceBlock.position + 1,
              blockId: window.crypto.randomUUID()
            },
            content: [
              {
                type: 'listItem',
                attrs: {
                  position: position === 'before' ? sourceBlock.position : sourceBlock.position + 1,
                  blockId: window.crypto.randomUUID()
                },
                content: [
                  {
                    type: 'paragraph',
                    attrs: {
                      position: position === 'before' ? sourceBlock.position : sourceBlock.position + 1,
                      blockId: window.crypto.randomUUID()
                    },
                    content: []
                  }
                ]
              }
            ]
          }
        ]
      } : {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  attrs: {
                    textAlign: 'left',
              position: position === 'before' ? sourceBlock.position : sourceBlock.position + 1,
              blockId: window.crypto.randomUUID()
                  },
            content: [] // Пустой контент, элемент будет добавлен автоматически
                }
              ]
            },
            hasAccess: true,
            userPermission: 'owner'
          };

    // Обновляем массив блоков
    const updatedBlocks = [...blocks];
    
    // Вставляем новый блок в правильную позицию
    const insertIndex = position === 'before' ? sourceBlock.position : sourceBlock.position + 1;
    updatedBlocks.splice(insertIndex, 0, newBlock);

           // Обновляем позиции всех блоков
    updatedBlocks.forEach((block, index) => {
      block.position = index;
      if (block.content && block.content.attrs) {
        block.content.attrs.position = index;
      }
    });

    // Очищаем пустые параграфы
    // const cleanedBlocks = cleanupBlocksContent(updatedBlocks);
    const cleanedBlocks = updatedBlocks;

    // Обновляем состояние
    setBlocks(cleanedBlocks);

    // Сохраняем на сервер
    const serverData = cleanedBlocks.map(block => ({
      blockId: block.id,
      blockType: block.blockType,
      pageId: block.pageId,
      content: block.content
    }));

    saveBlocksToServer(pageId, serverData);

    // Инициируем автоматический драг элемента в новый блок
        setTimeout(() => {
      
      // Создаем событие для автоматического перемещения элемента
      const autoDragEvent = new CustomEvent('auto-drag-element-to-block', {
        detail: {
          sourceBlockId,
          elementId,
          targetBlockId: newBlock.id,
          pageId
        }
      });
      
      document.dispatchEvent(autoDragEvent);
    }, 100);
  };

    // Drag and Drop логика
  const { state: dragState, handlers: dragHandlers } = useDragAndDrop({
    onBlockMove: (sourceId, targetId, position) => {
      // Проверяем, что это не drag элемента
      if (sourceId.startsWith('element:')) {
        return;
      }

      // Проверяем, что это drag блока
      if (!sourceId.startsWith('block:')) {
        // Добавляем префикс block: если его нет
        sourceId = `block:${sourceId}`;
      }

      // Извлекаем ID блока из формата "block:blockId"
      const blockId = sourceId.replace('block:', '');

      // Находим блоки
      const sourceBlock = blocks.find(b => b.id === blockId);
      const targetBlock = blocks.find(b => b.id === targetId);

      if (!sourceBlock || !targetBlock) {
        return;
      }

      // Создаем новый массив блоков
      const newBlocks = blocks.filter(b => b.id !== blockId);

      // Находим позицию вставки
      const targetIndex = newBlocks.findIndex(b => b.id === targetId);
      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;

      // Вставляем блок в новую позицию
      newBlocks.splice(insertIndex, 0, sourceBlock);

      // Обновляем позиции всех блоков
      const updatedBlocks = newBlocks.map((block, index) => ({
        ...block,
        position: index,
        content: {
          ...block.content,
          attrs: {
            ...block.content.attrs,
            position: index
          }
        }
      }));

      // Обновляем состояние
      setBlocks(updatedBlocks);

      // Отправляем на сервер
      const serverData = updatedBlocks.map(block => ({
        blockId: block.id,
        blockType: block.blockType,
        pageId: block.pageId,
        content: block.content
      }));

      saveBlocksToServer(pageId, serverData);
    },
    onElementMove: (sourceId, targetId, position) => {
      // Убираем префикс element: из sourceId если есть
      const elementId = sourceId.replace('element:', '');

      // 🔧 ИСПРАВЛЕНИЕ: Находим исходный блок по sourceId (а не targetId!)
      const sourceBlock = blocks.find(b => b.id === sourceId);

      if (!sourceBlock) {
        return;
      }

      // Получаем ссылку на редактор исходного блока
      const sourceBlockRef = blockRefs.current.get(sourceId);

      if (!sourceBlockRef?.editor) {
        return;
      }

      // 🔧 ИСПРАВЛЕНИЕ: Получаем содержимое из исходного блока
      const editorContent = sourceBlockRef.editor.getJSON();

      // Обновляем исходный блок с новым содержимым
      const updatedBlock = {
        ...sourceBlock,
        content: editorContent
      };

      // Обновляем массив блоков
      const updatedBlocks = blocks.map(block =>
        block.id === sourceId ? updatedBlock : block
      );

      // Обновляем состояние
      setBlocks(updatedBlocks);

      // Отправляем на сервер
      const serverData = updatedBlocks.map(block => ({
        blockId: block.id,
        blockType: block.blockType,
        pageId: block.pageId,
        content: block.content
      }));

      saveBlocksToServer(pageId, serverData);
    },
    onBlockCreate: (sourceId, targetId) => {
      // Убираем префикс element: из sourceId
      const elementId = sourceId.replace('element:', '');

      // Находим целевой блок
      const targetBlock = blocks.find(b => b.id === targetId);
      if (!targetBlock) {
        return;
      }

      // Получаем ссылку на редактор блока
      const blockRef = blockRefs.current.get(targetId);
      if (!blockRef?.editor) {
        return;
      }

      // Получаем текущее содержимое блока из редактора
      const editorContent = blockRef.editor.getJSON();

      // Обновляем блок с новым содержимым
      const updatedBlock = {
        ...targetBlock,
        content: editorContent
      };

      // Обновляем массив блоков
      const updatedBlocks = blocks.map(block =>
        block.id === targetId ? updatedBlock : block
      );

      // Обновляем состояние
      setBlocks(updatedBlocks);

      // Отправляем на сервер
      const serverData = updatedBlocks.map(block => ({
        blockId: block.id,
        blockType: block.blockType,
        pageId: block.pageId,
        content: block.content
      }));

      saveBlocksToServer(pageId, serverData);
    },
  });

  // Используем хук для обработки DnD событий
  useDndEvents({
    blocks,
    blocksRef,
    blockRefs: blockRefs.current,
    isReady,
    setBlocks,
    saveBlocksToServer,
    pageId
  });

  // Убрали renderKey чтобы избежать перерендера страницы при создании/удалении блоков


  // Проверка готовности всех компонентов - логи отключены
  useEffect(() => {
    const checkReadiness = () => {
      // console.log('[PageEditor] 🔍 Checking editor readiness...', {
      //   blocksCount: blocks.length,
      //   blockRefsSize: blockRefs.current.size,
      //   diagnostics: editorDiagnostics.diagnostics
      // });

      if (blocks.length === 0) {
        // console.log('[PageEditor] No blocks, setting ready to true');
        setIsReady(true);
        return;
      }

      // Проверяем готовность без детальной диагностики
      const allReady = blockRefs.current.size === blocks.length && 
        Array.from(blockRefs.current.values()).every(ref => ref?.current?.editor);

      // console.log('[PageEditor] 🎯 Final readiness check:', {
      //   allReady,
      //   blocksCount: blocks.length,
      //   blockRefsSize: blockRefs.current.size
      // });

      if (!allReady && editorDiagnostics.recommendations.length > 0) {
        // console.warn('[PageEditor] ⚠️ Editors not ready. Recommendations:', editorDiagnostics.recommendations);
      }

      setIsReady(allReady);
    };

    checkReadiness();
  }, [blocks, editorDiagnostics, blockRefs, setIsReady]);

  // Периодическая диагностика отключена
  // useEffect(() => {
  //   if (blocks.length > 0 && blockRefs.current.size > 0) {
  //     const interval = setInterval(() => {
  //       if (!isReady) {
  //         console.log('[PageEditor] 🔄 Periodic diagnostics (editors not ready yet)...');
  //         editorDiagnostics.logBlockEditorsState(blockRefs.current);
  //       }
  //     }, 2000); // Каждые 2 секунды

  //     return () => clearInterval(interval);
  //   }
  // }, [blocks.length, blockRefs.current.size, isReady, editorDiagnostics]);

  // Загружаем блоки при инициализации
  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  // Логи рендеринга отключены
  // console.log('[PageEditor] Rendering blocks:', blocks);
  // console.log('[PageEditor] Current blockRefs state:', {
  //   size: blockRefs.current.size,
  //   keys: Array.from(blockRefs.current.keys()),
  //   entries: Array.from(blockRefs.current.entries()).map(([id, ref]) => ({
  //     id,
  //     hasRef: !!ref,
  //     hasCurrent: !!ref?.current,
  //     hasEditor: !!ref?.current?.editor,
  //     hasProvider: !!ref?.current?.provider
  //   }))
  // });

             // console.log('[PageEditor] 🎬 STARTING BLOCKS RENDER:', {
             //   blocksCount: blocks.length,
             //   blockIds: blocks.map(b => b.id),
             //   blockRefsCount: blockRefs.current.size,
             //   blockRefsKeys: Array.from(blockRefs.current.keys()),
             //   isReady
             // });

             // Глобальные тестовые функции для отладки
             useEffect(() => {
               (window as any).testBlockDropZones = () => {
                 console.log('🧪 [Test] Testing block drop zones...');
                 const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
                 console.log('🧪 [Test] Found drop zones:', dropZones.length);
                 dropZones.forEach((zone, index) => {
                   const blockId = zone.getAttribute('data-block-id');
                   const position = zone.getAttribute('data-position');
                   console.log(`🧪 [Test] Drop zone ${index + 1}:`, { blockId, position });
                 });
                 return dropZones;
               };

               (window as any).showDropZones = () => {
                 console.log('🧪 [Test] Showing all drop zones...');
                 const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
                 dropZones.forEach((zone) => {
                   (zone as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                   (zone as HTMLElement).style.border = '2px dashed #3b82f6';
                   (zone as HTMLElement).style.height = '30px';
                 });
                 console.log('🧪 [Test] Drop zones highlighted');
               };

               (window as any).simulateElementDrag = (elementId: string) => {
                 console.log('🧪 [Test] Simulating element drag:', elementId);
                 const element = document.querySelector(`[data-element-id="${elementId}"]`);
                 if (element) {
                   const dragEvent = new DragEvent('dragstart', {
                     bubbles: true,
                     cancelable: true,
                     dataTransfer: new DataTransfer()
                   });
                   element.dispatchEvent(dragEvent);
                   console.log('🧪 [Test] Drag event dispatched');
                 } else {
                   console.warn('🧪 [Test] Element not found:', elementId);
                 }
               };

               (window as any).testDropZonePositioning = () => {
                 console.log('🧪 [Test] Testing drop zone positioning...');
                 const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
                 dropZones.forEach((zone, index) => {
                   const rect = zone.getBoundingClientRect();
                   const blockId = zone.getAttribute('data-block-id');
                   const position = zone.getAttribute('data-position');
                   console.log(`🧪 [Test] Drop zone ${index + 1}:`, {
                     blockId,
                     position,
                     top: rect.top,
                     left: rect.left,
                     width: rect.width,
                     height: rect.height
                   });
                 });
               };

               (window as any).testListMarkers = () => {
                 console.log('🧪 [Test] Testing list markers...');
                 const markers = document.querySelectorAll('.list-marker');
                 console.log('🧪 [Test] Found markers:', markers.length);
                 markers.forEach((marker, index) => {
                   const rect = marker.getBoundingClientRect();
                   const styles = window.getComputedStyle(marker);
                   const alignmentOffset = rect.top - marker.parentElement?.getBoundingClientRect().top || 0;
                   const isAligned = Math.abs(alignmentOffset) < 5; // 5px tolerance
                   
                   console.log(`🧪 [Test] Marker ${index + 1}:`, {
                     width: styles.width,
                     height: styles.height,
                     fontSize: styles.fontSize,
                     color: styles.color,
                     fontWeight: styles.fontWeight,
                     textShadow: styles.textShadow,
                     backgroundColor: styles.backgroundColor,
                     alignItems: styles.alignItems,
                     justifyContent: styles.justifyContent,
                     alignSelf: styles.alignSelf,
                     marginTop: styles.marginTop,
                     alignmentOffset,
                     isAligned
                   });
                 });
                 return markers;
               };

               console.log('🧪 [Test] Global test functions added to window object');
             }, []);

             return (
       <EnhancedDndProviderV2>
         <div>
        {blocks.map((block, index) => {

          const blockEditable = block.userPermission === "edit" || block.userPermission === "owner";
          // Логи проверки редактируемости отключены
          // console.log('[PageEditor] 📝 Block editable check:', {
          //   blockId: block.id,
          //   userPermission: block.userPermission,
          //   blockEditable,
          //   globalEditable: editable,
          //   willRender: block.hasAccess
          // });

                    return (
                      <React.Fragment key={block.id}>
                        {/* Дроп-зона перед первым блоком */}
                        {index === 0 && (() => {
                          return (
                            <BlockDropZone
                              blockId={block.id}
                              position="before"
                            />
                          );
                        })()}
                        
                        {block.hasAccess ? (
                            <EnhancedBlockHandle
                  blockId={block.id}
                  onDragStart={dragHandlers.handleBlockDragStart}
                  onDragEnd={dragHandlers.handleBlockDragEnd}
                  onBlockDrop={dragHandlers.handleBlockDrop}
                  onElementDrop={dragHandlers.handleElementDrop}
                >
                <BlockWrapper
                block={block}
                editable={blockEditable}
                onBlockCreated={handleBlockCreated}
                onBlockDeleted={handleBlockDeleted}
                allBlocks={blocks}
                saveBlocksToServer={saveBlocksToServer}
                pageId={pageId}
                syncPageOriginId={syncPageOriginId}
                onFocus={() => setFocusedBlockId(block.id)}
                onNavigateUp={() => navigateUp(block.id)}
                onNavigateDown={() => navigateDown(block.id)}
                onCreateBlockAfter={() => {
                  console.log('[PageEditor] onCreateBlockAfter called for block:', block.id);
                  console.trace('[PageEditor] Call stack for onCreateBlockAfter');
                  
                  // Создаем новый блок
                  const newBlock = createBlockBetween(block.id, null);

                  if (newBlock) {
                    // Находим позицию для вставки - сразу после текущего блока
                    const currentBlockIndex = blocks.findIndex(b => b.id === block.id);
                    
                    // Создаем новый массив с иммутабельными обновлениями
                    const updatedBlocks = blocks.map((existingBlock, index) => {
                      if (index > currentBlockIndex) {
                        // Обновляем позиции блоков после вставки
                        return {
                          ...existingBlock,
                          position: index + 1,
                      content: {
                        ...existingBlock.content,
                        attrs: {
                          ...(existingBlock.content.attrs || {}),
                          position: index + 1
                        }
                      }
                        };
                      }
                      return existingBlock;
                    });

                    // Вставляем новый блок в правильную позицию
                    updatedBlocks.splice(currentBlockIndex + 1, 0, {
                      ...newBlock,
                      position: currentBlockIndex + 1,
                      content: {
                        ...newBlock.content,
                        attrs: {
                          ...((newBlock.content as any).attrs || {}),
                          position: currentBlockIndex + 1
                        }
                      }
                    });

                    // Обновляем состояние
                    setBlocks(updatedBlocks);

                    // Сохраняем на сервер
                    const serverData = updatedBlocks.map(block => ({
                      blockId: block.id,
                      blockType: block.blockType,
                      pageId: block.pageId,
                      content: block.content
                    }));

                    // Асинхронное сохранение для оптимизации
                    setTimeout(() => {
                      saveBlocksToServer(pageId, serverData);
                    }, 0);

                    // Фокусируемся на новом блоке немедленно (убрали setTimeout для оптимизации)
                    focusBlockWithRetry(newBlock.id, 'start');
                  }
                }}
                onCreateBlockAtEnd={() => {
                  const newBlock = createBlockAtEnd();
                  if (newBlock) {
                    // Создаем новый массив с иммутабельными обновлениями
                    const updatedBlocks = blocks.map((existingBlock, index) => ({
                      ...existingBlock,
                      position: index,
                      content: {
                        ...existingBlock.content,
                        attrs: {
                          ...(existingBlock.content.attrs || {}),
                          position: index
                        }
                      }
                    }));

                    // Добавляем новый блок в конец
                    const finalBlocks = [...updatedBlocks, {
                      ...newBlock,
                      position: blocks.length,
                      content: {
                        ...newBlock.content,
                        attrs: {
                          ...((newBlock.content as any).attrs || {}),
                          position: blocks.length
                        }
                      }
                    }];

                    // Обновляем состояние
                    setBlocks(finalBlocks);

                    // Сохраняем на сервер
                    const serverData = finalBlocks.map(block => ({
                      blockId: block.id,
                      blockType: block.blockType,
                      pageId: block.pageId,
                      content: block.content
                    }));

                    // Асинхронное сохранение для оптимизации
                    setTimeout(() => {
                      saveBlocksToServer(pageId, serverData);
                    }, 0);

                    // Фокусируемся на новом блоке
                    handleBlockCreated(newBlock);
                  }
                }}
                onDeleteBlock={() => handleBlockDeleted(block.id)}
                setBlockRef={(ref) => {
                  // Логи отключены для упрощения отладки
                  if (ref) {
                    blockRefs.current.set(block.id, ref);
                  } else {
                    blockRefs.current.delete(block.id);
                  }
                }}
              />
            </EnhancedBlockHandle>
                        ) : null}
            
            {/* Дроп-зона после каждого блока */}
            {(() => {
              return (
                <BlockDropZone
                  blockId={block.id}
                  position="after"
                />
              );
            })()}
          </React.Fragment>
          );
        })}
      </div>
      </EnhancedDndProviderV2>
    );
  }
