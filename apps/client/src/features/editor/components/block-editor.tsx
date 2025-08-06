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

  // Подключаемся к серверу с задержкой
  useEffect(() => {
    if (provider) {
      const timer = setTimeout(() => {
        try {
          provider.connect();
          setIsInitialized(true);
        } catch (error) {
          console.error('[BlockEditor] Provider connection error:', error);
        }
      }, Math.random() * 1000);

      return () => {
        clearTimeout(timer);
        try {
          provider.destroy();
        } catch (error) {
          console.error('[BlockEditor] Provider destroy error:', error);
        }
      };
    }
  }, [provider]);

  // Инициализируем контент блока
  const initializeBlockContent = useMemo(() => {
    console.log('[BlockEditor] Initializing content for block:', block.id, 'content:', block.content);
    
    if (!block.content || block.content === null || block.content === undefined) {
      console.log('[BlockEditor] No content found, creating empty paragraph');
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
        console.log('[BlockEditor] Parsed string content:', normalizedContent);
      } catch (e) {
        console.warn('Failed to parse block content:', block.content);
        normalizedContent = null;
      }
    } else {
      normalizedContent = block.content;
      console.log('[BlockEditor] Using object content:', normalizedContent);
    }

    if (normalizedContent && typeof normalizedContent === 'object') {
      if (normalizedContent.type === 'doc' && 
          normalizedContent.content && 
          Array.isArray(normalizedContent.content)) {
        
        console.log('[BlockEditor] Content is already a doc, processing...');
        
        const contentWithBlockId = normalizedContent.content.map((node: any) => {
          if (node && typeof node === 'object') {
            return {
              ...node,
              attrs: { ...node.attrs, blockId: block.id }
            };
          }
          return node;
        }).filter(Boolean);

        const result = {
          ...normalizedContent,
          content: contentWithBlockId
        };
        
        console.log('[BlockEditor] Final processed doc content:', result);
        return result;
      }
      
      if (normalizedContent.type && normalizedContent.type !== 'doc') {
        console.log('[BlockEditor] Content is a single element, wrapping in doc...');
        
        const wrappedContent = {
          type: "doc",
          content: [
            {
              ...normalizedContent,
              attrs: { ...normalizedContent.attrs, blockId: block.id }
            }
          ]
        };
        
        console.log('[BlockEditor] Wrapped content:', wrappedContent);
        return wrappedContent;
      }
    }

    console.log('[BlockEditor] Content structure invalid, using fallback');
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

  // Настройка расширений для блока
  const extensions = useMemo(() => {
    const baseExtensions = [
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

    if (provider && isInitialized && currentUser?.user) {
      return [
        ...baseExtensions,
        ...collabExtensions(provider, currentUser.user),
      ];
    }

    return baseExtensions;
  }, [provider, currentUser?.user, block.id, isInitialized]);

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
          // Устанавливаем флаг готовности после успешного создания
          setTimeout(() => setEditorReady(true), 50);
        } catch (error) {
          console.error('[BlockEditor] Error in onCreate:', error);
        }
      }
    },
    onUpdate: handleEditorUpdate,
  }, [block.id, block.pageId, editable, initializeBlockContent, extensions]);

  if (!editor || !editorReady) {
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