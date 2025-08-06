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
        setBlocks(Array.isArray(blocksData) ? blocksData : []);
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
  const handleBlockCreated = useCallback((newBlock: Block) => {
    setBlocks(prevBlocks => {
      const updatedBlocks = [...prevBlocks, newBlock];
      saveBlocksToServer(pageId, updatedBlocks);
      return updatedBlocks;
    });
  }, [pageId, saveBlocksToServer]);

  // Обработчик удаления блока
  const handleBlockDeleted = useCallback((blockId: string) => {
    setBlocks(prevBlocks => {
      const updatedBlocks = prevBlocks.filter(block => block.id !== blockId);
      saveBlocksToServer(pageId, updatedBlocks);
      return updatedBlocks;
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
        console.log('[PageEditorBlocks] Rendering block:', block.id, 'hasAccess:', block.hasAccess);
        return block.hasAccess ? (
          <BlockEditor
            key={block.id}
            block={block}
            editable={editable && (block.userPermission === "edit" || block.userPermission === "owner")}
            onBlockUpdate={handleBlockUpdate}
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