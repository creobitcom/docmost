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
  const saveBlocksToServer = useDebouncedCallback(async (pageId: string, updatedBlocks: Block[]) => {
    try {
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
        block.id === blockId 
          ? { ...block, content: newContent }
          : block
      );
      saveBlocksToServer(pageId, updatedBlocks);
      return updatedBlocks;
    });
  }, [pageId, saveBlocksToServer]);

  console.log('[PageEditorBlocks] Rendering blocks:', blocks);

  // Убеждаемся, что blocks является массивом
  const blocksArray = Array.isArray(blocks) ? blocks : [];

  return (
    <div>
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
        
        return block.hasAccess ? (
          <BlockEditor
            key={block.id}
            block={block}
            editable={editable && (block.userPermission === "edit" || block.userPermission === "owner")}
            onBlockUpdate={handleBlockUpdate}
            onCreateBlock={handleCreateBlock}
            onDeleteBlock={handleDeleteBlock}
            onFocusBlock={handleFocusBlock}
          />
        ) : (
          <div 
            key={block.id}
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