import React, { useEffect, useState, useCallback } from "react";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { BlockEditor } from "./components/block-editor";
import { useDebouncedCallback } from '@mantine/hooks';

interface Block {
  id: string;
  pageId: string;
  content: any;
  position: number;
  creatorId?: string;
  hasAccess?: boolean;
  userPermission?: string;
}

interface PageEditorBlocksProps {
  pageId: string;
  editable: boolean;
  content: any;
  syncPageOriginId?: string | null;
}

export default function PageEditorBlocks({
  pageId,
  editable,
  content,
  syncPageOriginId,
}: PageEditorBlocksProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [visibleBlocks, setVisibleBlocks] = useState<Set<string>>(new Set());
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string | null; position: 'before' | 'after' | null }>({ targetId: null, position: null });

  // Функция для загрузки блоков страницы
  const fetchBlocks = useCallback(async () => {
    try {
      const response = await fetch(`/api/pages/${pageId}/blocks`, { 
        credentials: "include" 
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('[PageEditorBlocks] Fetched blocks:', responseData);
        
        // Извлекаем массив блоков из ответа
        const blocksData = responseData.data || responseData;
        const blocksArray = Array.isArray(blocksData) ? blocksData : [];
        setBlocks(blocksArray);
        
        // Показываем первые 5 блоков сразу
        const initialVisibleBlocks = new Set(blocksArray.slice(0, 5).map(block => block.id));
        setVisibleBlocks(initialVisibleBlocks);
        
        // Постепенно показываем остальные блоки
        if (blocksArray.length > 5) {
          let currentIndex = 5;
          const interval = setInterval(() => {
            if (currentIndex < blocksArray.length) {
              setVisibleBlocks(prev => {
                const newSet = new Set(prev);
                // Показываем по 3 блока за раз
                for (let i = 0; i < 3 && currentIndex + i < blocksArray.length; i++) {
                  newSet.add(blocksArray[currentIndex + i].id);
                }
                return newSet;
              });
              currentIndex += 3;
            } else {
              clearInterval(interval);
            }
          }, 200); // Задержка 200мс между группами блоков
        }
      } else {
        console.error('[PageEditorBlocks] Failed to fetch blocks:', response.status);
        // Если блоки не найдены, создаем блок из старого контента
        if (content) {
          const fallbackBlock: Block = {
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            pageId,
            content: content,
            position: 0,
            hasAccess: true,
            userPermission: editable ? "edit" : "read"
          };
          setBlocks([fallbackBlock]);
          setVisibleBlocks(new Set([fallbackBlock.id]));
        }
      }
    } catch (error) {
      console.error('[PageEditorBlocks] Error fetching blocks:', error);
      // Fallback: создаем блок из старого контента
      if (content) {
        const fallbackBlock: Block = {
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          pageId,
          content: content,
          position: 0,
          hasAccess: true,
          userPermission: editable ? "edit" : "read"
        };
        setBlocks([fallbackBlock]);
        setVisibleBlocks(new Set([fallbackBlock.id]));
      }
    }
  }, [pageId, content, editable]);

  // Инициализация при загрузке
  useEffect(() => {
    if (!isInitialized) {
      fetchBlocks();
      setIsInitialized(true);
    }
  }, [fetchBlocks, isInitialized]);

  // Постепенное отображение блоков с оптимизированными параметрами
  useEffect(() => {
    if (blocks.length > 0 && visibleBlocks.size === 0) {
      // Начинаем с первых 2 блоков для большей стабильности
      const initialBlocks = blocks.slice(0, 2).map(block => block.id);
      setVisibleBlocks(new Set(initialBlocks));

      // Добавляем остальные блоки по одному для максимальной стабильности
      let currentIndex = 2;
      const interval = setInterval(() => {
        if (currentIndex < blocks.length) {
          const nextBlock = blocks[currentIndex].id;
          setVisibleBlocks(prev => new Set([...prev, nextBlock]));
          currentIndex += 1;
        } else {
          clearInterval(interval);
        }
      }, 1500); // Увеличили интервал до 1.5 секунды для стабильности

      return () => clearInterval(interval);
    }
  }, [blocks]);

  // Debounced функция для сохранения блоков на сервере
  const ENABLE_SERVER_BLOCKS_API = true;

  const saveBlocksToServer = useDebouncedCallback(async (pageId: string, updatedBlocks: Block[]) => {
    try {
      if (!ENABLE_SERVER_BLOCKS_API) return;
      const response = await fetch(`/api/pages/${pageId}/blocks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({ blocks: updatedBlocks }),
      });

      if (!response.ok) {
        console.error('[PageEditorBlocks] Failed to save blocks:', response.status);
      }
    } catch (error) {
      console.error('[PageEditorBlocks] Error saving blocks:', error);
    }
  }, 3000);

  // Сохранение только позиций (без контента), чтобы не перетирать данные
  const saveBlockPositionsToServer = useDebouncedCallback(async (pageId: string, updatedBlocks: Block[]) => {
    try {
      if (!ENABLE_SERVER_BLOCKS_API) return;
      const payload = updatedBlocks.map(b => ({ id: b.id, position: b.position }));
      const response = await fetch(`/api/pages/${pageId}/blocks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({ blocks: payload }),
      });

      if (!response.ok) {
        console.error('[PageEditorBlocks] Failed to save block positions:', response.status);
      }
    } catch (error) {
      console.error('[PageEditorBlocks] Error saving block positions:', error);
    }
  }, 500);

  // Сохранение одного блока (контент + позиция) — точечно, чтобы избежать перезаписей
  const saveSingleBlockToServer = useDebouncedCallback(async (pageId: string, block: Block) => {
    try {
      if (!ENABLE_SERVER_BLOCKS_API) return;
      const payload = [{ id: block.id, position: block.position, content: block.content }];
      const response = await fetch(`/api/pages/${pageId}/blocks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({ blocks: payload }),
      });

      if (!response.ok) {
        console.error('[PageEditorBlocks] Failed to save block:', block.id, response.status);
      }
    } catch (error) {
      console.error('[PageEditorBlocks] Error saving single block:', error);
    }
  }, 500);

  // Обработчик создания нового блока
  const handleCreateBlock = useCallback((blockId: string) => {
    console.log('[PageEditorBlocks] handleCreateBlock called with blockId:', blockId);
    
    const newBlockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newBlock: Block = {
      id: newBlockId,
      pageId,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { blockId: newBlockId },
            content: []
          }
        ]
      },
      position: blocks.length,
      hasAccess: true,
      userPermission: editable ? "edit" : "read"
    };

    console.log('[PageEditorBlocks] Creating new block:', newBlock);

    setBlocks(prevBlocks => {
      const updatedBlocks = [...prevBlocks, newBlock];
      // Откладываем сохранение на сервер
      setTimeout(() => saveBlocksToServer(pageId, updatedBlocks), 0);
      return updatedBlocks;
    });
    
    setVisibleBlocks(prev => new Set([...prev, newBlock.id]));
    
    // Фокусируемся на новом блоке с задержкой
    setTimeout(() => {
      try {
        const newBlockElement = document.querySelector(`[data-block-id="${newBlock.id}"]`);
        if (newBlockElement && newBlockElement.isConnected) {
          const editorElement = newBlockElement.querySelector('.ProseMirror');
          if (editorElement && editorElement instanceof HTMLElement && editorElement.offsetParent !== null) {
            editorElement.focus();
          }
        }
      } catch (error) {
        console.warn('[PageEditorBlocks] Error focusing new block:', error);
      }
    }, 100);
  }, [pageId, blocks.length, editable, saveBlocksToServer]);

  // Обработчик удаления блока
  const handleDeleteBlock = useCallback((blockId: string) => {
    console.log('[PageEditorBlocks] handleDeleteBlock called with blockId:', blockId);
    
    const currentBlockIndex = blocks.findIndex(block => block.id === blockId);
    const targetBlockId = currentBlockIndex > 0 ? blocks[currentBlockIndex - 1].id : 
                         currentBlockIndex < blocks.length - 1 ? blocks[currentBlockIndex + 1].id : null;

    console.log('[PageEditorBlocks] Deleting block at index:', currentBlockIndex, 'targetBlockId:', targetBlockId);

    setBlocks(prevBlocks => {
      const updatedBlocks = prevBlocks.filter(block => block.id !== blockId);
      // Откладываем сохранение на сервер
      setTimeout(() => saveBlocksToServer(pageId, updatedBlocks), 0);
      return updatedBlocks;
    });
    
    setVisibleBlocks(prev => {
      const newSet = new Set(prev);
      newSet.delete(blockId);
      return newSet;
    });

    // Фокусируемся на соседнем блоке с задержкой
    if (targetBlockId) {
      setTimeout(() => {
        try {
          const targetBlockElement = document.querySelector(`[data-block-id="${targetBlockId}"]`);
          if (targetBlockElement && targetBlockElement.isConnected) {
            const editorElement = targetBlockElement.querySelector('.ProseMirror');
            if (editorElement && editorElement instanceof HTMLElement && editorElement.offsetParent !== null) {
              editorElement.focus();
            }
          }
        } catch (error) {
          console.warn('[PageEditorBlocks] Error focusing target block:', error);
        }
      }, 100);
    }
  }, [blocks, pageId, saveBlocksToServer]);

  // Обработчик фокуса на блоке
  const handleFocusBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    console.log('[PageEditorBlocks] handleFocusBlock called with blockId:', blockId, 'direction:', direction);
    
    const currentBlockIndex = blocks.findIndex(block => block.id === blockId);
    let targetBlockId: string | null = null;

    if (direction === 'up' && currentBlockIndex > 0) {
      targetBlockId = blocks[currentBlockIndex - 1].id;
    } else if (direction === 'down' && currentBlockIndex < blocks.length - 1) {
      targetBlockId = blocks[currentBlockIndex + 1].id;
    }

    console.log('[PageEditorBlocks] Focusing block at index:', currentBlockIndex, 'targetBlockId:', targetBlockId);

    if (targetBlockId) {
      setTimeout(() => {
        try {
          const targetBlockElement = document.querySelector(`[data-block-id="${targetBlockId}"]`);
          if (targetBlockElement && targetBlockElement.isConnected) {
            const editorElement = targetBlockElement.querySelector('.ProseMirror');
            if (editorElement && editorElement instanceof HTMLElement && editorElement.offsetParent !== null) {
              editorElement.focus();
            }
          }
        } catch (error) {
          console.warn('[PageEditorBlocks] Error focusing block:', error);
        }
      }, 50);
    }
  }, [blocks]);

  // Обработчик создания нового блока (для обратной совместимости)
  const handleBlockCreated = useCallback((newBlock: Block) => {
    setBlocks(prevBlocks => {
      const updatedBlocks = [...prevBlocks, newBlock];
      saveBlocksToServer(pageId, updatedBlocks);
      return updatedBlocks;
    });
    setVisibleBlocks(prev => new Set([...prev, newBlock.id]));
  }, [pageId, saveBlocksToServer]);

  // Обработчик удаления блока (для обратной совместимости)
  const handleBlockDeleted = useCallback((blockId: string) => {
    setBlocks(prevBlocks => {
      const updatedBlocks = prevBlocks.filter(block => block.id !== blockId);
      saveBlocksToServer(pageId, updatedBlocks);
      return updatedBlocks;
    });
    setVisibleBlocks(prev => {
      const newSet = new Set(prev);
      newSet.delete(blockId);
      return newSet;
    });
  }, [pageId, saveBlocksToServer]);

  // Обработчик обновления блока
  const handleBlockUpdate = useCallback((blockId: string, newContent: any) => {
    setBlocks(prevBlocks => {
      const updatedBlocks = prevBlocks.map(block =>
        block.id === blockId ? { ...block, content: newContent } : block,
      );
      const updated = updatedBlocks.find(b => b.id === blockId);
      if (updated) {
        // сохраняем только изменённый блок
        saveSingleBlockToServer(pageId, updated);
      }
      return updatedBlocks;
    });
  }, [pageId]);

  // DRAG & DROP сортировка блоков
  const dragStateRef = React.useRef<{ draggingId: string | null }>({ draggingId: null });

  const onDragHandleStart = useCallback((e: React.DragEvent) => {
    const blockElement = (e.currentTarget as HTMLElement)?.closest('[data-block-id]') as HTMLElement | null;
    const blockId = blockElement?.getAttribute('data-block-id') || null;
    if (!blockId) return;
    dragStateRef.current.draggingId = blockId;
    e.dataTransfer.setData('application/x-block-id', blockId);
    e.dataTransfer.effectAllowed = 'move';
    // Не даём событию подниматься в TipTap/PM
    e.stopPropagation();
    // Чуть менее навязчивый drag-образ
    if (blockElement) {
      const img = document.createElement('div');
      img.style.width = '1px';
      img.style.height = '1px';
      document.body.appendChild(img);
      e.dataTransfer.setDragImage(img, 0, 0);
      setTimeout(() => document.body.removeChild(img), 0);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types.includes('application/x-block-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetEl = (e.target as HTMLElement)?.closest('[data-block-id]') as HTMLElement | null;
    if (!targetEl) {
      setDropIndicator({ targetId: null, position: null });
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const isBefore = e.clientY < (rect.top + rect.height / 2);
    const targetId = targetEl.getAttribute('data-block-id');
    if (targetId) {
      setDropIndicator((prev) => (
        prev.targetId === targetId && prev.position === (isBefore ? 'before' : 'after')
          ? prev
          : { targetId, position: isBefore ? 'before' : 'after' }
      ));
    } else {
      setDropIndicator({ targetId: null, position: null });
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types.includes('application/x-block-id')) return;
    e.preventDefault();
    e.stopPropagation();
    const fromId = dragStateRef.current.draggingId || e.dataTransfer.getData('application/x-block-id');
    const target = (e.target as HTMLElement)?.closest('[data-block-id]') as HTMLElement | null;
    const toId = target?.getAttribute('data-block-id') || dropIndicator.targetId || null;
    if (!fromId || !toId || fromId === toId) return;

    setBlocks(prev => {
      const current = [...prev];
      const fromIndex = current.findIndex(b => b.id === fromId);
      const toIndex = current.findIndex(b => b.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = current.splice(fromIndex, 1);
      // Вычисляем индекс вставки на основе before/after, как в tiptap
      let insertIndex = toIndex;
      const pos = dropIndicator.position;
      if (pos === 'after') insertIndex = toIndex + 1;
      if (fromIndex < insertIndex) insertIndex -= 1; // скорректировать из-за вырезания
      current.splice(insertIndex, 0, moved);
      // пересчёт позиций
      const updated = current.map((b, idx) => ({ ...b, position: idx }));
      // сохраняем позиции на сервер
      setTimeout(() => saveBlockPositionsToServer(pageId, updated), 0);
      return updated;
    });
    dragStateRef.current.draggingId = null;
    setDropIndicator({ targetId: null, position: null });
  }, [pageId]);

  console.log('[PageEditorBlocks] Rendering blocks:', blocks);

  // Убеждаемся, что blocks является массивом
  const blocksArray = Array.isArray(blocks) ? blocks : [];

  const onDragEnd = useCallback(() => {
    dragStateRef.current.draggingId = null;
    setDropIndicator({ targetId: null, position: null });
  }, []);

  return (
    <div onDragOver={onDragOver} onDragOverCapture={onDragOver} onDrop={onDrop} onDropCapture={onDrop} onDragEnd={onDragEnd}>
      {blocksArray.map((block) => {
        console.log('[PageEditorBlocks] Rendering block:', block.id, 'hasAccess:', block.hasAccess, 'visible:', visibleBlocks.has(block.id));
        
        // Показываем блок только если он видим
        if (!visibleBlocks.has(block.id)) {
          return (
            <div 
              key={block.id}
              style={{ 
                minHeight: '1.5em',
                padding: '0.5em',
                backgroundColor: '#f9f9f9',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                marginBottom: '0.5em'
              }}
            >
              Загрузка...
            </div>
          );
        }

        console.log('[PageEditorBlocks] Rendering BlockEditor for block:', block.id, {
          hasCreateBlock: !!handleCreateBlock,
          hasDeleteBlock: !!handleDeleteBlock,
          hasFocusBlock: !!handleFocusBlock
        });
        
        return (
          <React.Fragment key={block.id}>
            {dropIndicator.targetId === block.id && dropIndicator.position === 'before' && (
              <div className="drop-indicator" />
            )}
            {block.hasAccess ? (
              <BlockEditor
                block={block}
                editable={editable && (block.userPermission === "edit" || block.userPermission === "owner")}
                onBlockUpdate={handleBlockUpdate}
                onDragHandleStart={onDragHandleStart}
                onCreateBlock={handleCreateBlock}
                onDeleteBlock={handleDeleteBlock}
                onFocusBlock={handleFocusBlock}
              />
            ) : (
          <div 
            style={{ 
              padding: '1em',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '0.5em'
            }}
          >
            <p style={{ margin: 0, color: '#666' }}>
              Нет доступа к этому блоку (ID: {block.id})
            </p>
          </div>
            )}
            {dropIndicator.targetId === block.id && dropIndicator.position === 'after' && (
              <div className="drop-indicator" />
            )}
          </React.Fragment>
        );
      })}

      {blocksArray.length === 0 && (
        <div style={{ 
          padding: '2em',
          textAlign: 'center',
          color: '#666'
        }}>
          Загрузка блоков...
        </div>
      )}
    </div>
  );
} 