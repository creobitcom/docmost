import React, { useEffect, useMemo, useState, Suspense, useRef, useCallback } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditor, EditorContent } from "@tiptap/react";
import { mainExtensions, collabExtensions, creobitExtentions } from "@/features/editor/extensions/extensions";
import { BlockId } from "@/features/editor/extensions/block-id";
import Document from "@tiptap/extension-document";
import "@/features/editor/styles/drag-handle.css";

import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { useDebouncedCallback } from '@mantine/hooks';
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import LinkMenu from "@/features/editor/components/link/link-menu.tsx";
import ExcalidrawMenu from "./excalidraw/excalidraw-menu";
import DrawioMenu from "./drawio/drawio-menu";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";


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
  onCreateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onFocusBlock?: (blockId: string, direction: 'up' | 'down') => void;
  onDragHandleStart?: (e: React.DragEvent) => void;
}

// Компонент-обертка для изоляции редактора
function EditorWrapper({ block, editable, onBlockUpdate, onCreateBlock, onDeleteBlock, onFocusBlock, onDragHandleStart }: BlockEditorProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const collaborationURL = useCollaborationUrl();
  const { data: collabQuery } = useCollabToken();
  const [editorReady, setEditorReady] = useState(false);
  const [isDestroying, setIsDestroying] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  
  // Refs для более надежного управления жизненным циклом
  const editorRef = useRef<any>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const mountTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const domElementRef = useRef<HTMLElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Создаем отдельный YDoc для каждого блока
  const ydoc = useMemo(() => {
    if (!isMountedRef.current) return null;
    const newYdoc = new Y.Doc();
    ydocRef.current = newYdoc;
    return newYdoc;
  }, [block.id]);
  
  // Создаем HocuspocusProvider для блока
  const provider = useMemo(() => {
    if (!isMountedRef.current || !ydoc) return null;
    const token = collabQuery?.token;
    if (!token) return null;

    const newProvider = new HocuspocusProvider({
      url: collaborationURL,
      name: `block.${block.id}.${block.pageId}`,
      document: ydoc,
      token,
      connect: false,
      preserveConnection: false,
    });
    providerRef.current = newProvider;
    return newProvider;
  }, [block.id, block.pageId, collaborationURL, collabQuery?.token, ydoc]);

  // Подключаем WebSocket-провайдера на время жизни компонента
  useEffect(() => {
    if (!provider || !isMountedRef.current) return;
    try {
      console.log('[BlockEditor] Connecting provider for block:', block.id);
      provider.connect();
    } catch (error) {
      console.error('[BlockEditor] Provider connection error:', error);
    }
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
  }, [provider, block.id]);

  // Инициализируем контент блока с оптимизированной логикой
  const initializeBlockContent = useMemo(() => {
    if (!isMountedRef.current) return null;
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
    if (onBlockUpdate && isMountedRef.current && !isDestroying) {
      onBlockUpdate(block.id, newContent);
    }
  }, 2000);

  // Обработчик обновления редактора
  const handleEditorUpdate = useCallback(({ editor }: { editor: any }) => {
    if (!editor || isDestroying || editor.isEmpty || !isMountedRef.current) return;
    
    try {
      const editorJson = editor.getJSON();
      console.log('[BlockEditor] Editor JSON:', editorJson);

      const blockContent = editorJson.content?.[0] || null;
      
      if (blockContent) {
        debouncedUpdateBlock(blockContent);
      }
    } catch (error) {
      console.error('[BlockEditor] Error in handleEditorUpdate:', error);
    }
  }, [isDestroying, debouncedUpdateBlock]);

  // Настройка расширений для блока (временно без коллаборации)
  const extensions = useMemo(() => {
    if (!isMountedRef.current) return [];
    // Исключаем расширения, конфликтующие с блоковым DnD (иначе TipTap будет переносить контент)
    const filteredMain = (mainExtensions as any[]).filter((ext: any) => {
      const name = (ext && (ext.name || ext?.config?.name))?.toString().toLowerCase();
      // ВАЖНО: исключаем кастомный Document с контент-выражением (block|container)+
      // для блочного редактора нужен базовый Document без групп
      return name !== 'doc' && name !== 'global-drag-handle' && name !== 'selection' && name !== 'blockgroup' && name !== 'block-group';
    });

    const filteredCreobit = (creobitExtentions as any[]).filter((ext: any) => {
      const name = (ext && (ext.name || ext?.config?.name))?.toString().toLowerCase();
      return name !== 'block-id' && name !== 'global-drag-handle' && name !== 'selection' && name !== 'blockgroup' && name !== 'block-group';
    });

    return [
      // Подключаем стандартный Document, чтобы избежать ошибки схемы
      Document,
      ...filteredMain,
      ...filteredCreobit,
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
     immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    enableCoreExtensions: true,
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      scrollThreshold: 80,
      scrollMargin: 80,
      // На уровне ProseMirror полностью блокируем drop для DnD блоков
      handleDrop: (_view, event) => {
        try {
          const types = (event as DragEvent).dataTransfer?.types;
          if (types && Array.from(types).includes('application/x-block-id')) {
            event.preventDefault();
            return true;
          }
        } catch {}
        return false;
      },
      handleDOMEvents: {
          dragover: (_view, event) => {
            try {
              const types = (event as DragEvent).dataTransfer?.types;
              if (types && Array.from(types).includes('application/x-block-id')) {
                event.preventDefault();
                return true;
              }
            } catch {}
            return false;
          },
          drop: (_view, event) => {
            try {
              const types = (event as DragEvent).dataTransfer?.types;
              if (types && Array.from(types).includes('application/x-block-id')) {
                event.preventDefault();
                return true;
              }
            } catch {}
            return false;
          },
        keydown: (view, event) => {
          if (isDestroying || !isMountedRef.current) return false;
          
          // Дополнительная проверка на существование view и DOM
          if (!view || !view.dom || !view.dom.isConnected) {
            return false;
          }
          
          // Проверяем наличие активных меню
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

          // Обработка навигации по блокам
          if (["ArrowUp", "ArrowDown", "Enter", "Backspace"].includes(event.key)) {
            try {
              const { selection } = view.state;
              const { $from } = selection;
              const currentBlockId = $from.node().attrs?.blockId || block.id;

              if (currentBlockId) {
                switch (event.key) {
                  case "Enter":
                    if (onCreateBlock && isMountedRef.current) {
                      event.preventDefault();
                      console.log(`[BlockEditor] Creating new block from ${currentBlockId}`);
                      onCreateBlock(currentBlockId);
                      return true;
                    }
                    break;
                  case "Backspace":
                    // Проверяем, что блок пустой и курсор в начале
                    const isEmpty = $from.parent.content.size === 0 || 
                                   ($from.parent.content.size === 1 && 
                                    $from.parent.firstChild?.type.name === 'hardBreak');
                    const isAtStart = $from.parentOffset === 0;
                    
                    if (isEmpty && isAtStart && onDeleteBlock && isMountedRef.current) {
                      event.preventDefault();
                      console.log(`[BlockEditor] Deleting block ${currentBlockId}`);
                      onDeleteBlock(currentBlockId);
                      return true;
                    }
                    break;
                  case "ArrowUp":
                    if (onFocusBlock && $from.parentOffset === 0 && isMountedRef.current) {
                      event.preventDefault();
                      console.log(`[BlockEditor] Focusing block up from ${currentBlockId}`);
                      onFocusBlock(currentBlockId, 'up');
                      return true;
                    }
                    break;
                  case "ArrowDown":
                    if (onFocusBlock && $from.parentOffset === $from.parent.content.size && isMountedRef.current) {
                      event.preventDefault();
                      console.log(`[BlockEditor] Focusing block down from ${currentBlockId}`);
                      onFocusBlock(currentBlockId, 'down');
                      return true;
                    }
                    break;
                }
              }
            } catch (error) {
              console.warn('[BlockEditor] Error in keydown handler:', error);
              return false;
            }
          }
          
          return false;
        },
      },
    },
    onCreate({ editor }) {
      console.log(`[BlockEditor] onCreate called for block ${block.id}`);
      
      if (!isMountedRef.current) {
        console.log(`[BlockEditor] Component not mounted for block ${block.id}`);
        return;
      }
      
      editorRef.current = editor;
      domElementRef.current = editor.view.dom;
      
      // Устанавливаем pageId в storage для доступа в bubble menu
      if (editor && block.pageId) {
        editor.storage.pageId = block.pageId;
        editor.storage.blockId = block.id;
      }
      if (currentUser?.user?.id) {
        editor.storage.userId = currentUser.user.id;
      }
      
      console.log(`[BlockEditor] Editor created for block ${block.id}:`, {
        hasEditor: !!editor,
        hasView: !!editor?.view,
        hasDom: !!editor?.view?.dom,
        pageId: editor?.storage?.pageId
      });
      
      // Используем requestAnimationFrame для более стабильного рендеринга
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          console.log(`[BlockEditor] Setting editor ready for block ${block.id}`);
          setEditorReady(true);
        } else {
          console.log(`[BlockEditor] Component unmounted during onCreate for block ${block.id}`);
        }
      });
    },
    onUpdate: handleEditorUpdate,
  }, [block.id, editable, initializeBlockContent, onCreateBlock, onDeleteBlock, onFocusBlock, isDestroying, isMountedRef]);

  // Улучшенный cleanup для редактора и YDoc
  useEffect(() => {
    return () => {
      // Устанавливаем флаги уничтожения
      setIsDestroying(true);
      setShouldRender(false);
      isMountedRef.current = false;
      
      // Очищаем таймауты
      if (mountTimeoutRef.current) {
        clearTimeout(mountTimeoutRef.current);
        mountTimeoutRef.current = null;
      }
      
      // Немедленно уничтожаем редактор
      if (editorRef.current && !editorRef.current.isDestroyed) {
        try {
          console.log('[BlockEditor] Destroying editor for block:', block.id);
          editorRef.current.destroy();
        } catch (error) {
          console.error('[BlockEditor] Error destroying editor:', error);
        }
        editorRef.current = null;
      }
      
      // Уничтожаем provider
      if (providerRef.current) {
        try {
          console.log('[BlockEditor] Destroying provider for block:', block.id);
          providerRef.current.destroy();
        } catch (error) {
          console.error('[BlockEditor] Provider destroy error:', error);
        }
        providerRef.current = null;
      }
      
      // Уничтожаем YDoc
      if (ydocRef.current) {
        try {
          console.log('[BlockEditor] Destroying YDoc for block:', block.id);
          ydocRef.current.destroy();
        } catch (error) {
          console.error('[BlockEditor] Error destroying YDoc:', error);
        }
        ydocRef.current = null;
      }
    };
  }, [block.id]);

  // Улучшенная проверка для рендеринга
  const shouldRenderEditor = useMemo(() => {
    const canRender = shouldRender && 
                     !isDestroying && 
                     editorReady && 
                     editor && 
                     !editor.isDestroyed && 
                     editor.view && 
                     editor.view.dom && 
                     isMountedRef.current;
    
    // Добавляем отладочную информацию
    if (!canRender) {
      console.log(`[BlockEditor] Cannot render block ${block.id}:`, {
        shouldRender,
        isDestroying,
        editorReady,
        hasEditor: !!editor,
        editorDestroyed: editor?.isDestroyed,
        hasView: !!editor?.view,
        hasDom: !!editor?.view?.dom,
        isMounted: isMountedRef.current
      });
    }
    
    return canRender;
  }, [shouldRender, isDestroying, editorReady, editor, isMountedRef, block.id]);

  return (
    <div 
      data-block-id={block.id}
      style={{ 
        minHeight: '1.5em', 
        padding: '0.5em',
        border: 'none',
        borderRadius: '0',
        backgroundColor: 'transparent',
        position: 'relative'
      }}
    >
      {(() => {
        try {
                      // Показываем редактор если он готов, или пытаемся его показать
            if (editor && !editor.isDestroyed && editor.view && editor.view.dom) {
              return (
                <div>
                  {/* Drag handle */}
                  <div
                    className="block-drag-handle"
                    contentEditable={false}
                    draggable={true}
                    onDragStart={onDragHandleStart}
                    title="Перетащите для изменения позиции"
                  />
                  <div ref={menuContainerRef}>
                    <EditorContent 
                      editor={editor} 
                      ref={(el) => {
                        if (el && isMountedRef.current) {
                          domElementRef.current = el;
                        }
                      }}
                    />

                     {editor && editor.isEditable && !isDestroying && isMountedRef.current && (
                      <div>
                        <EditorBubbleMenu editor={editor} />
                        <TableMenu editor={editor} />
                        <TableCellMenu editor={editor} appendTo={menuContainerRef} />
                        <ImageMenu editor={editor} />
                        <VideoMenu editor={editor} />
                        <CalloutMenu editor={editor} />
                        <ExcalidrawMenu editor={editor} />
                        <DrawioMenu editor={editor} />
                        <LinkMenu editor={editor} appendTo={menuContainerRef} />
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          
          // Показываем состояние загрузки
          if (isDestroying) {
            return (
              <div style={{ 
                minHeight: '1.5em',
                color: '#666',
                fontStyle: 'italic'
              }}>
                Удаление блока...
              </div>
            );
          }
          
          return (
            <div style={{ 
              minHeight: '1.5em',
              color: '#666',
              fontStyle: 'italic'
            }}>
              Загрузка блока...
            </div>
          );
        } catch (error) {
          console.error('[BlockEditor] Rendering error:', error);
          return (
            <div style={{ 
              padding: '0.5em',
              border: '1px solid #ff6b6b',
              borderRadius: '4px',
              backgroundColor: '#ffe6e6',
              color: '#d63031'
            }}>
              Ошибка рендеринга редактора
            </div>
          );
        }
      })()}
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