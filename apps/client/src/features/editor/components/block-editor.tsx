import React, { useEffect, useMemo, useState, Suspense } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditor, EditorContent } from "@tiptap/react";
import { mainExtensions, collabExtensions, creobitExtentions } from "@/features/editor/extensions/extensions";
import { BlockId } from "@/features/editor/extensions/block-id";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { useDebouncedCallback } from '@mantine/hooks';
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";


interface Block {
  id: string;
  pageId: string;
  content: any;
  position: number;
  creatorId?: string;
  hasAccess?: boolean;
  userPermission?: string;
}

interface BlockEditorProps {
  block: Block;
  editable: boolean;
  onBlockUpdate?: (blockId: string, content: any) => void;
}

// Компонент-обертка для изоляции редактора
function EditorWrapper({ block, editable, onBlockUpdate }: BlockEditorProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const collaborationURL = useCollaborationUrl();
  const { data: collabQuery } = useCollabToken();
  const [isInitialized, setIsInitialized] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  
  // Создаем отдельный YDoc для каждого блока
  const ydoc = useMemo(() => new Y.Doc(), [block.id]);
  
  // Создаем HocuspocusProvider для блока
  const provider = useMemo(() => {
    const token = collabQuery?.token;
    if (!token) return null;

    return new HocuspocusProvider({
      url: collaborationURL,
      name: `block.${block.id}.${block.pageId}`,
      document: ydoc,
      token,
      connect: false,
      preserveConnection: false,
    });
  }, [block.id, block.pageId, collaborationURL, collabQuery?.token, ydoc]);

  // Временно отключаем WebSocket для тестирования
  useEffect(() => {
    if (provider && !isInitialized) {
      // Временно не подключаемся к WebSocket для исключения проблем с сетью
      console.log('[BlockEditor] Skipping WebSocket connection for block:', block.id);
      setIsInitialized(true);
      
      return () => {
        if (provider) {
          try {
            console.log('[BlockEditor] Destroying provider for block:', block.id);
            provider.destroy();
          } catch (error) {
            console.error('[BlockEditor] Provider destroy error:', error);
          }
        }
      };
    }
  }, [provider, isInitialized, block.id]);

  // Инициализируем контент блока с оптимизированной логикой
  const initializeBlockContent = useMemo(() => {
    // Уменьшаем количество логов для производительности
    if (!block.content || block.content === null || block.content === undefined) {
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { blockId: block.id },
            content: []
          }
        ]
      };
    }

    let normalizedContent;
    if (typeof block.content === 'string') {
      try {
        normalizedContent = JSON.parse(block.content);
      } catch (e) {
        console.warn('[BlockEditor] Failed to parse block content:', block.content);
        normalizedContent = null;
      }
    } else {
      normalizedContent = block.content;
    }

    if (normalizedContent && typeof normalizedContent === 'object') {
      // Проверяем, что это валидный Tiptap документ
      if (normalizedContent.type === 'doc' && 
          normalizedContent.content && 
          Array.isArray(normalizedContent.content)) {
        
        const contentWithBlockId = normalizedContent.content
          .filter((node: any) => node && typeof node === 'object')
          .map((node: any) => ({
            ...node,
            attrs: { ...node.attrs, blockId: block.id }
          }));

        return {
          ...normalizedContent,
          content: contentWithBlockId
        };
      }
      
      // Если это одиночный элемент, оборачиваем в doc
      if (normalizedContent.type && normalizedContent.type !== 'doc') {
        return {
          type: "doc",
          content: [
            {
              ...normalizedContent,
              attrs: { ...normalizedContent.attrs, blockId: block.id }
            }
          ]
        };
      }
    }

    // Fallback для невалидного контента
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: block.id },
          content: []
        }
      ]
    };
  }, [block.content, block.id]);

  // Debounced функция для обновления блока
  const debouncedUpdateBlock = useDebouncedCallback((newContent: any) => {
    if (onBlockUpdate) {
      onBlockUpdate(block.id, newContent);
    }
  }, 2000);

  // Обработчик обновления редактора
  const handleEditorUpdate = ({ editor }: { editor: any }) => {
    if (editor.isEmpty) return;
    
    const editorJson = editor.getJSON();
    console.log('[BlockEditor] Editor JSON:', editorJson);

    const blockContent = editorJson.content?.[0] || null;
    
    if (blockContent) {
      debouncedUpdateBlock(blockContent);
    }
  };

  // Настройка расширений для блока (временно без коллаборации)
  const extensions = useMemo(() => {
    return [
      ...mainExtensions,
      ...creobitExtentions.filter(ext => ext.name !== 'block-id'),
      BlockId.configure({
        attributeName: "blockId",
        types: ['paragraph', 'heading', 'block'],
        createId: () => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const result = uuidRegex.test(block.id) ? block.id : window.crypto.randomUUID();
          return result as `${string}-${string}-${string}-${string}-${string}`;
        },
      }),
    ];
  }, [block.id]);

  const editor = useEditor({
    extensions,
    editable,
    content: initializeBlockContent || {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: block.id },
          content: []
        }
      ]
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      scrollThreshold: 80,
      scrollMargin: 80,
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
            const slashCommand = document.querySelector("#slash-command");
            if (slashCommand) {
              return true;
            }
          }
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Enter",
            ].includes(event.key)
          ) {
            const emojiCommand = document.querySelector("#emoji-command");
            if (emojiCommand) {
              return true;
            }
          }
        },
      },
    },
    onCreate({ editor }) {
      if (editor) {
        try {
          editor.storage.pageId = block.pageId;
          editor.storage.blockId = block.id;
          // Увеличиваем задержку для стабилизации DOM
          setTimeout(() => {
            if (editor && !editor.isDestroyed) {
              setEditorReady(true);
            }
          }, 200);
        } catch (error) {
          console.error('[BlockEditor] Error in onCreate:', error);
        }
      }
    },
    onUpdate: handleEditorUpdate,
  }, [block.id, block.pageId, editable, initializeBlockContent, extensions]);

  if (!editor || !editorReady || editor.isDestroyed) {
    return (
      <div 
        data-block-id={block.id}
        style={{ 
          minHeight: '1.5em', 
          padding: '0.5em',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: '#f9f9f9'
        }}
      >
        Инициализация редактора...
      </div>
    );
  }

  return (
    <div 
      data-block-id={block.id}
      data-position={block.position}
      style={{ 
        position: 'relative',
        marginBottom: '0.5em'
      }}
    >
      <EditorContent editor={editor} />
      
      {editor && editor.isEditable && (
        <EditorBubbleMenu editor={editor} />
      )}
    </div>
  );
}

// Основной компонент с Suspense
export function BlockEditor(props: BlockEditorProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div 
        data-block-id={props.block.id}
        style={{ 
          minHeight: '1.5em', 
          padding: '0.5em',
          border: '1px solid #ff6b6b',
          borderRadius: '4px',
          backgroundColor: '#ffe6e6',
          color: '#d63031'
        }}
      >
        Ошибка загрузки блока. Попробуйте обновить страницу.
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div 
        data-block-id={props.block.id}
        style={{ 
          minHeight: '1.5em', 
          padding: '0.5em',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: '#f9f9f9'
        }}
      >
        Загрузка блока...
      </div>
    }>
      <ErrorBoundary onError={() => setHasError(true)}>
        <EditorWrapper {...props} />
      </ErrorBoundary>
    </Suspense>
  );
}

// Компонент для обработки ошибок
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[BlockEditor] Error caught by boundary:', error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div 
          style={{ 
            minHeight: '1.5em', 
            padding: '0.5em',
            border: '1px solid #ff6b6b',
            borderRadius: '4px',
            backgroundColor: '#ffe6e6',
            color: '#d63031'
          }}
        >
          Ошибка рендеринга блока
        </div>
      );
    }

    return this.props.children;
  }
} 