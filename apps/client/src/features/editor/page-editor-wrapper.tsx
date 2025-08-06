import React, { useState, useEffect } from "react";
import PageEditor from "./page-editor";
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
  const [useBlockArchitecture, setUseBlockArchitecture] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Проверяем, есть ли уже блоки для этой страницы
  useEffect(() => {
    const checkBlockArchitecture = async () => {
      try {
        const response = await fetch(`/api/pages/${pageId}/blocks`, {
          credentials: "include"
        });
        
        if (response.ok) {
          const blocks = await response.json();
          // Если есть блоки, используем новую архитектуру
          if (blocks && blocks.length > 0) {
            setUseBlockArchitecture(true);
          }
        }
      } catch (error) {
        console.log('[PageEditorWrapper] No blocks found, using legacy architecture');
      }
    };

    checkBlockArchitecture();
  }, [pageId]);

  // Функция для миграции в блок-архитектуру
  const migrateToBlocks = async () => {
    setIsMigrating(true);
    try {
      const response = await fetch(`/api/pages/${pageId}/migrate-to-blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Добавляем пустое тело запроса
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[PageEditorWrapper] Migration result:', result);
        setUseBlockArchitecture(true);
      } else {
        console.error('[PageEditorWrapper] Migration failed:', response.status);
      }
    } catch (error) {
      console.error('[PageEditorWrapper] Migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  // Переключатель архитектуры
  const toggleArchitecture = () => {
    if (useBlockArchitecture) {
      setUseBlockArchitecture(false);
    } else {
      migrateToBlocks();
    }
  };

  return (
    <div>
      {/* Переключатель архитектуры */}
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px', 
        zIndex: 1000,
        background: 'white',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '5px', fontSize: '12px' }}>
          Архитектура: {useBlockArchitecture ? 'Блоки' : 'Легаси'}
        </div>
        <button 
          onClick={toggleArchitecture}
          disabled={isMigrating}
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            cursor: isMigrating ? 'not-allowed' : 'pointer',
            opacity: isMigrating ? 0.5 : 1
          }}
        >
          {isMigrating ? 'Миграция...' : 'Переключить'}
        </button>
      </div>

      {/* Рендерим соответствующий редактор */}
      {useBlockArchitecture ? (
        <PageEditorBlocks
          pageId={pageId}
          editable={editable}
          content={content}
          syncPageOriginId={syncPageOriginId}
        />
      ) : (
        <PageEditor
          pageId={pageId}
          editable={editable}
          content={content}
          syncPageOriginId={syncPageOriginId}
        />
      )}
    </div>
  );
} 