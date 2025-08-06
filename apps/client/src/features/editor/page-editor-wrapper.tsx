import React, { useState, useEffect } from "react";
import PageEditorBlocks from "./page-editor-blocks";

interface PageEditorWrapperProps {
  pageId: string;
  editable: boolean;
  content: any;
  syncPageOriginId?: string | null;
}

export default function PageEditorWrapper({
  pageId,
  editable,
  content,
  syncPageOriginId,
}: PageEditorWrapperProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [hasBlocks, setHasBlocks] = useState(false);

  // Проверяем, есть ли уже блоки для этой страницы
  useEffect(() => {
    const checkBlockArchitecture = async () => {
      try {
        const response = await fetch(`/api/pages/${pageId}/blocks`, {
          credentials: "include"
        });
        
        if (response.ok) {
          const blocks = await response.json();
          // Если есть блоки, используем их
          if (blocks && blocks.length > 0) {
            setHasBlocks(true);
          } else {
            // Если блоков нет, автоматически мигрируем
            await migrateToBlocks();
          }
        } else {
          // Если запрос не удался, все равно мигрируем
          await migrateToBlocks();
        }
      } catch (error) {
        console.log('[PageEditorWrapper] Error checking blocks, migrating:', error);
        await migrateToBlocks();
      }
    };

    checkBlockArchitecture();
  }, [pageId]);

  // Функция для миграции в блок-архитектуру
  const migrateToBlocks = async () => {
    if (isMigrating) return;
    
    setIsMigrating(true);
    try {
      const response = await fetch(`/api/pages/${pageId}/migrate-to-blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[PageEditorWrapper] Migration completed:', result);
        setHasBlocks(true);
      } else {
        console.error('[PageEditorWrapper] Migration failed:', response.status);
        // Даже если миграция не удалась, показываем блоки (они могут быть пустыми)
        setHasBlocks(true);
      }
    } catch (error) {
      console.error('[PageEditorWrapper] Migration error:', error);
      // Даже при ошибке показываем блоки
      setHasBlocks(true);
    } finally {
      setIsMigrating(false);
    }
  };

  // Показываем индикатор загрузки во время миграции
  if (isMigrating) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#666'
      }}>
        <div>Миграция контента в блочную архитектуру...</div>
        <div style={{ fontSize: '12px', marginTop: '5px' }}>
          Это может занять несколько секунд
        </div>
      </div>
    );
  }

  // Всегда используем блочную архитектуру
  return (
    <PageEditorBlocks
      pageId={pageId}
      editable={editable}
      content={content}
      syncPageOriginId={syncPageOriginId}
    />
  );
} 