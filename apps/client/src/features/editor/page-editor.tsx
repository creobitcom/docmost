import "@/features/editor/styles/index.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  onAuthenticationFailedParameters,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { EditorContent, EditorProvider, useEditor } from "@tiptap/react";
import {
  collabExtensions,
  creobitExtentions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { useDebouncedCallback } from '@mantine/hooks';
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { yjsConnectionStatusAtom } from "./atoms/editor-atoms";

function getTokenFromCollabQuery(collabQuery: any): string | undefined {
  console.log('[getTokenFromCollabQuery] collabQuery:', collabQuery);
  if (!collabQuery) return undefined;
  if (typeof collabQuery.token === 'string') return collabQuery.token;
  if (collabQuery.data && typeof collabQuery.data.token === 'string') return collabQuery.data.token;
  return undefined;
}



async function saveBlocksToServer(pageId, blocks) {
  console.log('[saveBlocksToServer] Saving blocks:', blocks);
  const response = await fetch(`/api/pages/blocks/${pageId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[saveBlocksToServer] Error:', response.status, errorText);
  } else {
    console.log('[saveBlocksToServer] Success');
  }
}

async function deleteBlock(pageId: string, blockId: string) {
  const response = await fetch(`/api/pages/blocks/${pageId}/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ blockId }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete block');
  }

  return response.json();
}

// Компонент-заглушка для блоков без доступа
function PlaceholderBlock({ block }) {
  return (
    <div style={{ padding: '10px', border: '1px dashed #ccc', margin: '5px 0' }}>
      <p>Блок недоступен для редактирования</p>
    </div>
  );
}

const BlockEditor = forwardRef(({
    block,
    editable,
    onBlockCreated,
    onBlockDeleted,
    allBlocks,
    saveBlocksToServer,
    pageId,
    syncPageOriginId,
    onFocus,
    onNavigateUp,
    onNavigateDown,
    onCreateBlockAfter,
    onCreateBlockAtEnd,
    onDeleteBlock
  }: {
    block: any,
    editable: boolean,
    onBlockCreated: (block: any) => void,
    onBlockDeleted: (blockId: string) => void,
    allBlocks: any[],
    saveBlocksToServer: (pageId: string, blocks: any[]) => void,
    pageId: string,
    syncPageOriginId?: string | null,
    onFocus?: () => void,
    onNavigateUp?: () => void,
    onNavigateDown?: () => void,
    onCreateBlockAfter?: () => void,
    onCreateBlockAtEnd?: () => void,
    onDeleteBlock?: () => void
  }, ref) => {
  const [currentUser] = useAtom(currentUserAtom);
  const ydoc = useMemo(() => new Y.Doc(), [block.id]);
  const collaborationURL = useCollaborationUrl();
  const documentName = syncPageOriginId
  ? `page.${syncPageOriginId}`
  : `page.${pageId}`;
  const { data: collabQuery, isLoading: tokenLoading } = useCollabToken();
  const [, setYjsConnectionStatus] = useAtom(yjsConnectionStatusAtom);
  const token = getTokenFromCollabQuery(collabQuery);

  console.log('[BlockEditor] Token loading:', tokenLoading, 'Token:', token ? 'present' : 'missing');

  // Если токен загружается, показываем загрузку
  if (tokenLoading) {
    return <div>Загрузка редактора...</div>;
  }

  // Функция для проверки наличия текста в параграфе
  const hasTextContent = (paragraph) => {
    if (!paragraph || !paragraph.content) return false;

    // Проверяем, есть ли текстовые узлы с содержимым
    for (const node of paragraph.content) {
      if (node.type === 'text' && node.text && node.text.trim().length > 0) {
        return true;
      }
      // Рекурсивно проверяем вложенные узлы
      if (node.content && hasTextContent(node)) {
        return true;
      }
    }
    return false;
  };

  // Парсим контент из JSON строки
  let parsedContent;
  try {
    parsedContent = typeof block.content === 'string'
      ? JSON.parse(block.content)
      : block.content;
  } catch (e) {
    console.warn('Failed to parse block content:', block.content);
    parsedContent = null;
  }

  console.log('[BlockEditor] block.content:', block.content);
  console.log('[BlockEditor] parsedContent:', parsedContent);

  // Гарантируем валидный контент - каждый блок содержит только один параграф
  let contentToInit;

  if (
    parsedContent &&
    typeof parsedContent === 'object' &&
    typeof parsedContent.type === 'string'
  ) {
    if (parsedContent.type === 'doc') {
      // Берем только первый параграф или создаем пустой только если контент действительно пустой
      const paragraphs = parsedContent.content?.filter(node =>
        node.type === 'paragraph'
      ) || [];

      if (paragraphs.length > 0) {
        // Берем только первый параграф и добавляем метаданные
        const firstParagraph = paragraphs[0];
        // Проверяем, что параграф не пустой
        if (hasTextContent(firstParagraph)) {
          // Гарантируем, что создается только один параграф
          contentToInit = {
            type: 'doc',
            content: [{
              ...firstParagraph,
              attrs: {
                ...firstParagraph.attrs,
                position: block.position,
                blockId: block.id
              }
            }]
          };

          // Дополнительная проверка - убеждаемся, что в content только один элемент
          if (contentToInit.content.length > 1) {
            console.warn('[BlockEditor] Multiple content elements detected, keeping only first');
            contentToInit.content = [contentToInit.content[0]];
          }
        } else {
          // Если параграф пустой, не создаем контент вообще
          contentToInit = null;
        }
      } else {
        // Если нет параграфов, не создаем контент вообще
        contentToInit = null;
      }
    } else if (parsedContent.type === 'paragraph') {
      // Если это параграф, проверяем что он не пустой
      if (hasTextContent(parsedContent)) {
        contentToInit = {
          type: 'doc',
          content: [{
            ...parsedContent,
            attrs: {
              ...parsedContent.attrs,
              position: block.position,
              blockId: block.id
            }
          }]
        };
      } else {
        // Если параграф пустой, не создаем контент
        contentToInit = null;
      }
    } else {
      // Оборачиваем одиночный узел в doc только если он не пустой
      if (hasTextContent(parsedContent)) {
        contentToInit = {
          type: 'doc',
          content: [{
            ...parsedContent,
            attrs: {
              ...parsedContent.attrs,
              position: block.position,
              blockId: block.id
            }
          }]
        };
      } else {
        // Если узел пустой, не создаем контент
        contentToInit = null;
      }
    }
  } else {
    // Если контент пустой или null - не создаем контент вообще
    contentToInit = null;
  }

  console.log('[BlockEditor] contentToInit:', contentToInit);

  const provider = useMemo(() => {
    // Если нет токена, создаем провайдер без коллаборации
    if (!token) {
      return null;
    }

    return new HocuspocusProvider({
      url: collaborationURL,
      name: `block.${block.id}`,
      document: ydoc,
      token,
    });
  }, [block.id, collaborationURL, token]);

  const handleEditorUpdate = useDebouncedCallback((editor) => {
    const json = editor.getJSON();
    console.log('[BlockEditor] Editor JSON:', json);

    // Берем только первый параграф из редактора
    const firstParagraph = json.content?.find(node =>
      node.type === 'paragraph'
    );

    // Проверяем, что параграф не пустой - проверяем наличие текста
    if (firstParagraph && hasTextContent(firstParagraph)) {
      // Проверяем валидность контента перед отправкой
      const isValidContent = (node) => {
        if (!node || typeof node !== 'object') return false;
        if (!node.type || typeof node.type !== 'string') return false;
        if (node.content && Array.isArray(node.content)) {
          return node.content.every(isValidContent);
        }
        return true;
      };

      if (!isValidContent(firstParagraph)) {
        console.warn('[BlockEditor] Invalid content detected, skipping save');
        return;
      }

      // Проверяем, что в параграфе нет дублирующихся blockId
      const blockIds = new Set();
      const checkForDuplicateBlockIds = (node) => {
        if (node.attrs && node.attrs.blockId) {
          if (blockIds.has(node.attrs.blockId)) {
            return false; // Дублирующийся blockId
          }
          blockIds.add(node.attrs.blockId);
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.every(checkForDuplicateBlockIds);
        }
        return true;
      };

      if (!checkForDuplicateBlockIds(firstParagraph)) {
        console.warn('[BlockEditor] Duplicate blockId detected, skipping save');
        return;
      }

      // Создаем обновленный список всех блоков страницы
      const updatedBlocks = allBlocks.map(existingBlock => {
        if (existingBlock.id === block.id) {
          return {
            blockId: existingBlock.id,
            blockType: existingBlock.blockType,
            pageId: existingBlock.pageId,
            content: {
              ...firstParagraph,
              attrs: {
                ...firstParagraph.attrs,
                position: existingBlock.position, // Сохраняем существующий position
                blockId: existingBlock.id // Добавляем blockId
              }
            }
          };
        }
        // Для остальных блоков оставляем как есть
        return {
          blockId: existingBlock.id,
          blockType: existingBlock.blockType,
          pageId: existingBlock.pageId,
          content: existingBlock.content
        };
      });

      console.log('[BlockEditor] Saving all blocks:', updatedBlocks);
      saveBlocksToServer(block.pageId, updatedBlocks);
    } else {
      console.log('[BlockEditor] Skipping save - paragraph is empty');
    }
  }, 2000);

  const extensions = useMemo(() => {
    const baseExtensions = [...mainExtensions, ...creobitExtentions];

    // Добавляем коллаборационные расширения только если есть провайдер
    if (provider) {
      return [...baseExtensions, ...collabExtensions(provider, currentUser?.user)];
    }

    return baseExtensions;
  }, [provider, currentUser?.user]);

  console.log('[BlockEditor] Creating editor with editable:', editable, 'extensions count:', extensions.length);

  const editor = useEditor({
    extensions,
    editable,
    content: contentToInit || {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: {
          textAlign: 'left',
          position: block.position,
          blockId: block.id
        },
        content: []
      }]
    },
    editorProps: {
      attributes: {
        "data-block-id": block.id,
      },
      handleKeyDown: (view, event) => {
        const { state } = view;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Навигация стрелками между блоками
        if (event.key === 'ArrowUp' && $from.parentOffset === 0) {
          // В начале параграфа - переходим к предыдущему блоку
          if (onNavigateUp) {
            event.preventDefault();
            onNavigateUp();
            return true;
          }
        }

        if (event.key === 'ArrowDown' && $from.parentOffset === $from.parent.content.size) {
          // В конце параграфа - переходим к следующему блоку
          if (onNavigateDown) {
            event.preventDefault();
            onNavigateDown();
            return true;
          }
        }

                        // Удаление блока при Backspace в пустом параграфе
                if (event.key === 'Backspace' && parentType === 'paragraph' && $from.parent.content.size === 0) {
                  if (onDeleteBlock) {
                    event.preventDefault();
                    event.stopPropagation();

                    // Используем requestAnimationFrame для синхронизации с DOM
                    requestAnimationFrame(() => {
                      try {
                        onDeleteBlock();
                      } catch (error) {
                        console.warn('Error deleting block:', error);
                      }
                    });
                    return true;
                  }
                }

        // Enter в конце параграфа создаёт новый блок
        if (
          event.key === 'Enter' &&
          parentType === 'paragraph' &&
          $from.parentOffset === $from.parent.content.size
        ) {
          event.preventDefault();

          // Проверяем, не создали ли мы уже этот блок
          const newBlockId = window.crypto.randomUUID();
          const existingBlock = allBlocks.find(b => b.id === newBlockId);
          if (existingBlock) {
            console.warn("Block with this ID already exists, skipping creation");
            return true;
          }

          // Создаем новый блок на клиенте
          const newBlock = {
            id: newBlockId,
            pageId: block.pageId,
            blockType: 'paragraph',
            position: block.position + 1,
            content: {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                position: block.position + 1,
                blockId: newBlockId
              },
              content: []
            },
            hasAccess: true,
            userPermission: 'owner'
          };
          console.log("Creating new block on client:", newBlock);

          // Создаем обновленный список всех блоков с новым блоком
          const updatedBlocks = [...allBlocks, {
            blockId: newBlock.id,
            blockType: newBlock.blockType,
            pageId: newBlock.pageId,
            content: {
              ...newBlock.content,
              attrs: {
                ...newBlock.content.attrs,
                position: newBlock.position
              }
            }
          }];

          // Отправляем полный список блоков на сервер
          saveBlocksToServer(block.pageId, updatedBlocks);

          onBlockCreated(newBlock);
          return true;
        }

        // Для других типов блоков — стандартное поведение
        return false;
      },
    },
    onCreate({ editor }) {
      console.log('[BlockEditor] Editor created successfully, editable:', editor.isEditable);

      // Проверяем, что в редакторе только один параграф
      try {
        const doc = editor.getJSON();
        if (doc.content && doc.content.length > 1) {
          console.warn('[BlockEditor] Multiple paragraphs detected in editor after creation, keeping only first');
          const firstParagraph = doc.content[0];
          editor.commands.setContent({
            type: 'doc',
            content: [firstParagraph]
          });
        }

        // Сохраняем ссылку на редактор и провайдер для ref
        if (ref && typeof ref === 'object') {
          ref.current = { editor, provider };
        }

        // Добавляем небольшую задержку для стабилизации Y.js
        requestAnimationFrame(() => {
          try {
            if (ref && typeof ref === 'object' && ref.current) {
              ref.current = { editor, provider };
            }
          } catch (error) {
            console.warn('[BlockEditor] Error updating ref:', error);
          }
        });
      } catch (error) {
        console.warn('[BlockEditor] Error in onCreate:', error);
      }
    },
    onUpdate({ editor }) {
      if (editor.isEmpty) return;

      try {
        // Проверяем, что в редакторе только один параграф
        const doc = editor.getJSON();
        if (doc.content && doc.content.length > 1) {
          console.warn('[BlockEditor] Multiple paragraphs detected in editor update, keeping only first');
          const firstParagraph = doc.content[0];
          editor.commands.setContent({
            type: 'doc',
            content: [firstParagraph]
          });
          return;
        }

        handleEditorUpdate(editor);
      } catch (error) {
        console.warn('[BlockEditor] Error in onUpdate:', error);
      }
    },
    onFocus({ editor }) {
      try {
        if (onFocus) {
          onFocus();
        }
      } catch (error) {
        console.warn('[BlockEditor] Error in onFocus:', error);
      }
    },
  });

  useEffect(() => () => {
    if (provider) {
      try {
        // Проверяем состояние провайдера перед уничтожением
        if (provider.isConnected) {
          provider.disconnect();
        }

        // Добавляем небольшую задержку перед уничтожением
        setTimeout(() => {
          try {
            provider.destroy();
            console.log('[BlockEditor] Provider destroyed on unmount');
          } catch (error) {
            console.warn('Error destroying provider:', error);
          }
        }, 10);
      } catch (error) {
        console.warn('Error destroying provider:', error);
      }
    }
  }, [provider]);

  // Добавляем обработчик для предотвращения DOM-конфликтов
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (provider) {
        try {
          if (provider.isConnected) {
            provider.disconnect();
          }
          setTimeout(() => {
            try {
              provider.destroy();
            } catch (error) {
              console.warn('Error destroying provider on unload:', error);
            }
          }, 10);
        } catch (error) {
          console.warn('Error destroying provider on unload:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && provider) {
        try {
          if (provider.isConnected) {
            provider.disconnect();
          }
          setTimeout(() => {
            try {
              provider.destroy();
            } catch (error) {
              console.warn('Error destroying provider on visibility change:', error);
            }
          }, 10);
        } catch (error) {
          console.warn('Error destroying provider on visibility change:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [provider]);

  useEffect(() => {
    // Инициализируем Y.js документ только если есть провайдер
    if (!provider) return;

    const yXmlFragment = ydoc.getXmlFragment("content");

    // Проверяем, есть ли уже контент в Y.js документе
    if (yXmlFragment.length > 0) {
      console.log('[BlockEditor] Y.js document already has content, skipping initialization');
      return;
    }

    if (yXmlFragment.length === 0) {
      // Если contentToInit равен null, не инициализируем Y.js документ
      if (!contentToInit) {
        console.log('[BlockEditor] contentToInit is null, skipping Y.js initialization');
        return;
      }

      // Используем requestAnimationFrame для синхронизации с DOM
      requestAnimationFrame(() => {
        try {
          // Проверяем, что contentToInit содержит только один параграф
          if (contentToInit.type === 'doc' && contentToInit.content && Array.isArray(contentToInit.content)) {
            const paragraphs = contentToInit.content.filter(node => node.type === 'paragraph');
            if (paragraphs.length > 1) {
              console.warn('[BlockEditor] Multiple paragraphs detected in contentToInit, using only first');
              contentToInit = {
                ...contentToInit,
                content: [paragraphs[0]]
              };
            }
          }

          const tempYdoc = TiptapTransformer.toYdoc(contentToInit, "default", extensions as any);
          const tempFragment = tempYdoc.getXmlFragment("content");
          let nodes = [];
          if (tempFragment && typeof tempFragment.toArray === "function") {
            nodes = tempFragment.toArray();
          } else if (Array.isArray(tempFragment)) {
            nodes = tempFragment;
          } else {
            nodes = [];
          }
          // Расширенное логирование для диагностики
          console.log('[BlockEditor][DIAG] block.content:', block.content);
          console.log('[BlockEditor][DIAG] contentToInit:', contentToInit);
          console.log('[BlockEditor][DIAG] tempFragment:', tempFragment);
          console.log('[BlockEditor][DIAG] nodes:', nodes);

          // Фильтруем только поддерживаемые узлы
          const validNodes = nodes.filter(node => {
            if (!(node instanceof Y.XmlElement || node instanceof Y.XmlText)) {
              return false;
            }
            // Проверяем, что это поддерживаемый тип узла
            if (node instanceof Y.XmlElement) {
              const supportedTypes = ['paragraph', 'heading', 'text'];
              return supportedTypes.includes(node.nodeName);
            }
            return true;
          });

          console.log('[BlockEditor][DIAG] validNodes:', validNodes);

          // Проверяем, есть ли контент в блоке
          if (validNodes.length === 0 && !hasTextContent(contentToInit)) {
            // Вставляем пустой параграф только если контент действительно пустой
            const yParagraph = new Y.XmlElement('paragraph');
            yXmlFragment.insert(0, [yParagraph]);
          } else if (validNodes.length > 0) {
            // Вставляем только первый узел, чтобы избежать дублирования
            // Проверяем, что узел имеет поддерживаемый тип
            const firstNode = validNodes[0];
            if (firstNode instanceof Y.XmlElement && firstNode.nodeName === 'paragraph') {
              // Проверяем, что в узле нет дублирующихся blockId
              const blockIds = new Set();
              const checkForDuplicateBlockIds = (node) => {
                if (node.getAttribute && node.getAttribute('blockId')) {
                  const blockId = node.getAttribute('blockId');
                  if (blockIds.has(blockId)) {
                    return false; // Дублирующийся blockId
                  }
                  blockIds.add(blockId);
                }
                if (node.children && node.children.length > 0) {
                  return node.children.every(checkForDuplicateBlockIds);
                }
                return true;
              };

              if (checkForDuplicateBlockIds(firstNode)) {
                yXmlFragment.insert(0, [firstNode]);
              } else {
                console.warn('[BlockEditor] Duplicate blockId detected in Y.js node, creating empty paragraph');
                const yParagraph = new Y.XmlElement('paragraph');
                yXmlFragment.insert(0, [yParagraph]);
              }
            } else {
              // Если тип не поддерживается, создаем пустой параграф
              const yParagraph = new Y.XmlElement('paragraph');
              yXmlFragment.insert(0, [yParagraph]);
            }
          }
          // Если validNodes.length === 0, но есть текстовый контент, не создаем пустой параграф
        } catch (error) {
          console.error('[BlockEditor] Error during Y.js initialization:', error);
          // В случае ошибки создаем пустой параграф
          const yParagraph = new Y.XmlElement('paragraph');
          yXmlFragment.insert(0, [yParagraph]);
        }
      });
    }
  }, [ydoc, contentToInit, provider, extensions]);

  console.log('[BlockEditor] Rendering editor, editor exists:', !!editor, 'editable:', editor?.isEditable);

  return (
    <>
      <div style={{ position: 'relative' }}>
        <EditorContent editor={editor} />
        {editor && <EditorBubbleMenu editor={editor} pageId={block.pageId} blockId={block.id} />}

        {/* Кнопка удаления блока */}
        {editable && onDeleteBlock && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              // Добавляем подтверждение удаления
              if (window.confirm('Вы уверены, что хотите удалить этот блок?')) {
                if (onDeleteBlock) {
                  // Используем requestAnimationFrame для синхронизации с DOM
                  requestAnimationFrame(() => {
                    try {
                      onDeleteBlock();
                    } catch (error) {
                      console.warn('Error deleting block:', error);
                    }
                  });
                }
              }
            }}
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              background: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              padding: '2px 6px',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: 0.7,
              zIndex: 1000
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.opacity = '0.7';
            }}
            title="Удалить блок"
          >
            ✕
          </button>
        )}
      </div>
    </>
  );
});



export default function PageEditor({ pageId, editable, content, syncPageOriginId }) {
  const [blocks, setBlocks] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const blockRefs = useRef(new Map());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Глобальная обработка ошибок для предотвращения DOM-конфликтов
  useEffect(() => {
    const originalErrorHandler = window.onerror;

    window.onerror = (message, source, lineno, colno, error) => {
      if (message && typeof message === 'string' && (
        message.includes('removeChild') ||
        message.includes('Node') ||
        message.includes('DOM')
      )) {
        console.warn('DOM error caught and suppressed:', message);
        return true; // Предотвращаем показ ошибки
      }
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
    };

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

    return () => {
      window.onerror = originalErrorHandler;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Проверка готовности всех компонентов
  useEffect(() => {
    const checkReadiness = () => {
      if (blocks.length === 0) {
        setIsReady(true);
        return;
      }

      const allReady = blocks.every(block => {
        const ref = blockRefs.current.get(block.id);
        return ref?.editor && ref?.provider;
      });
      setIsReady(allReady);
    };

    checkReadiness();
  }, [blocks]);

  // Функция для получения следующего блока
  const getNextBlock = (currentBlockId) => {
    const currentIndex = blocks.findIndex(block => block.id === currentBlockId);
    if (currentIndex >= 0 && currentIndex < blocks.length - 1) {
      return blocks[currentIndex + 1];
    }
    return null;
  };

  // Функция для получения предыдущего блока
  const getPreviousBlock = (currentBlockId) => {
    const currentIndex = blocks.findIndex(block => block.id === currentBlockId);
    if (currentIndex > 0) {
      return blocks[currentIndex - 1];
    }
    return null;
  };

    // Безопасное удаление блока с правильной последовательностью
  const deleteBlockSafely = async (blockId) => {
    try {
      // 1. Проверяем состояние
      if (isDeleting) {
        console.warn('Block deletion already in progress, skipping');
        return;
      }

      // 2. Проверяем готовность системы
      if (!isReady) {
        console.warn('System not ready for block deletion, waiting...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setIsDeleting(true);

      // 3. Получаем ссылку на блок и проверяем его существование
      const blockRef = blockRefs.current.get(blockId);
      const blockToDelete = blocks.find(b => b.id === blockId);

      if (!blockToDelete) {
        console.warn('Block not found for deletion:', blockId);
        return;
      }

      // 4. Проверяем, что это не последний блок
      if (blocks.length === 1) {
        console.warn('Cannot delete the last block');
        return;
      }

      // 4. Подготавливаем данные для сервера
      const updatedBlocks = blocks.filter(b => b.id !== blockId);
      const serverData = updatedBlocks.map((block, index) => ({
        blockId: block.id,
        blockType: block.blockType,
        pageId: block.pageId,
        content: {
          ...block.content,
          attrs: {
            ...block.content.attrs,
            position: index
          }
        }
      }));

      // 5. Отправляем на сервер ПЕРЕД обновлением состояния
      await saveBlocksToServer(pageId, serverData);

      // 6. Уничтожаем Y.js провайдер СИНХРОННО
      if (blockRef?.provider) {
        try {
          console.log('[deleteBlockSafely] Destroying provider for block:', blockId);

          // Проверяем состояние провайдера перед уничтожением
          if (blockRef.provider.isConnected) {
            blockRef.provider.disconnect();
          }

          // Добавляем небольшую задержку перед уничтожением
          await new Promise(resolve => setTimeout(resolve, 10));

          blockRef.provider.destroy();
        } catch (error) {
          console.warn('Error destroying provider:', error);
        }
      }

      // 7. Удаляем ссылки на блок
      blockRefs.current.delete(blockId);

            // 8. Обновляем состояние React с задержкой для синхронизации с DOM
      setTimeout(() => {
        try {
          setBlocks(updatedBlocks);

          // 9. Фокусируемся на следующем блоке
          const targetBlock = getNextBlock(blockId) || getPreviousBlock(blockId);
          if (targetBlock) {
            setTimeout(() => {
              try {
                focusBlock(targetBlock.id, 'end');
              } catch (error) {
                console.warn('Failed to focus target block after deletion:', error);
              }
            }, 50);
          }
        } catch (error) {
          console.warn('Error updating blocks state after deletion:', error);
        }
      }, 10);

    } catch (error) {
      console.error('Failed to delete block:', error);
    } finally {
      setTimeout(() => setIsDeleting(false), 100);
    }
  };

    // Функция для фокусировки на блоке
  const focusBlock = (blockId, position = 'end') => {
    try {
      const blockRef = blockRefs.current.get(blockId);
      if (!blockRef?.editor) {
        console.warn('Block ref not found for focus:', blockId);
        return;
      }

      const editor = blockRef.editor;

      // Проверяем, что редактор готов
      if (!editor.isEditable || !editor.view || !editor.view.dom) {
        console.warn('Editor not ready for focus:', blockId);
        return;
      }

      // Проверяем, что DOM-элемент все еще существует
      if (!editor.view.dom.parentNode) {
        console.warn('Editor DOM element no longer exists:', blockId);
        return;
      }

      setFocusedBlockId(blockId);

      // Используем requestAnimationFrame для синхронизации с DOM
      requestAnimationFrame(() => {
        try {
          if (position === 'end') {
            editor.commands.focus('end');
          } else {
            editor.commands.focus('start');
          }
        } catch (error) {
          console.warn('Error focusing editor:', error);
        }
      });
    } catch (error) {
      console.warn('Error in focusBlock:', error);
    }
  };

  // Функция для создания блока между существующими
  const createBlockBetween = (afterBlockId, beforeBlockId) => {
    const afterBlock = blocks.find(block => block.id === afterBlockId);
    const beforeBlock = blocks.find(block => block.id === beforeBlockId);

    if (!afterBlock || !beforeBlock) return;

    const newBlock = {
      id: window.crypto.randomUUID(),
      pageId: pageId,
      blockType: 'paragraph',
      position: afterBlock.position + 1,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { position: afterBlock.position + 1 }
          }
        ]
      }
    };

    const updatedBlocks = [...blocks];
    const insertIndex = updatedBlocks.findIndex(block => block.id === beforeBlockId);
    updatedBlocks.splice(insertIndex, 0, newBlock);

    // Обновляем позиции
    updatedBlocks.forEach((block, index) => {
      block.position = index;
      if (block.content && block.content.attrs) {
        block.content.attrs.position = index;
      }
    });

    setBlocks(updatedBlocks);
    return newBlock;
  };

  // Функция для создания блока в конце
  const createBlockAtEnd = () => {
    const newBlock = {
      id: window.crypto.randomUUID(),
      pageId: pageId,
      blockType: 'paragraph',
      position: blocks.length,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { position: blocks.length }
          }
        ]
      }
    };

    setBlocks(prev => [...prev, newBlock]);
    return newBlock;
  };

  // Обработчик создания блока
  const handleBlockCreated = (newBlock) => {
    // Обновляем позиции всех блоков
    const updatedBlocks = blocks.map((block, index) => ({
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

    setBlocks(updatedBlocks);

    // Фокусируемся на новом блоке
    requestAnimationFrame(() => {
      try {
        focusBlock(newBlock.id, 'start');
      } catch (error) {
        console.warn('Failed to focus new block:', error);
      }
    });
  };

  // Обработчик удаления блока
  const handleBlockDeleted = (blockId) => {
    deleteBlockSafely(blockId);
  };

  async function fetchBlocks() {
    const res = await fetch(`/api/pages/${pageId}/blocks`, { credentials: "include" });
    const result = await res.json();
    // Универсальная обработка вложенности
    let blocks = Array.isArray(result?.data?.data)
      ? result.data.data
      : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result)
      ? result
      : [];
    console.log("blocks data from API", blocks);
    setBlocks(blocks);

    // Если блоков нет и это первая инициализация - создаем первый блок только на клиенте
    if (blocks.length === 0 && !isInitialized) {
      console.log("No blocks found, creating initial block on client only");

      // Дополнительная проверка - убеждаемся, что блоков действительно нет
      try {
        const doubleCheckRes = await fetch(`/api/pages/${pageId}/blocks`, { credentials: "include" });
        const doubleCheckResult = await doubleCheckRes.json();
        const doubleCheckBlocks = Array.isArray(doubleCheckResult?.data?.data)
          ? doubleCheckResult.data.data
          : Array.isArray(doubleCheckResult?.data)
          ? doubleCheckResult.data
          : Array.isArray(doubleCheckResult)
          ? doubleCheckResult
          : [];

        if (doubleCheckBlocks.length > 0) {
          console.log("Blocks found on double check, using server data");
          setBlocks(doubleCheckBlocks);
          setIsInitialized(true);
          return;
        }
      } catch (error) {
        console.warn("Double check failed, proceeding with initial block creation:", error);
      }

      const initialBlock = {
        id: window.crypto.randomUUID(),
        pageId: pageId,
        blockType: 'paragraph',
        position: 0,
        content: {
          type: 'paragraph',
          attrs: {
            textAlign: 'left',
            position: 0,
            blockId: window.crypto.randomUUID() // Добавляем blockId
          },
          content: []
        },
        hasAccess: true,
        userPermission: 'owner'
      };
      console.log("Initial block created on client:", initialBlock);

      // Отправляем первый блок на сервер через тот же эндпоинт
      saveBlocksToServer(pageId, [{
        blockId: initialBlock.id,
        blockType: initialBlock.blockType,
        pageId: initialBlock.pageId,
        content: {
          ...initialBlock.content,
          attrs: {
            ...initialBlock.content.attrs,
            position: initialBlock.position
          }
        }
      }]);

      setBlocks([initialBlock]);
    }
    setIsInitialized(true);
  }

  useEffect(() => {
    fetchBlocks();
  }, [pageId]);

  console.log('[PageEditor] Rendering blocks:', blocks);

  return (
    <div>
      {isDeleting ? (
        <div style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
          Удаление блока...
        </div>
      ) : (
        blocks.map((block) => {
          console.log('[PageEditor] Rendering block:', block.id, 'hasAccess:', block.hasAccess, 'userPermission:', block.userPermission, 'editable:', editable);
          const blockEditable = block.userPermission === "edit" || block.userPermission === "owner";
          console.log('[PageEditor] Block editable check:', {
            blockId: block.id,
            userPermission: block.userPermission,
            blockEditable,
            globalEditable: editable
          });

          return block.hasAccess ? (
            <BlockEditor
              pageId={pageId}
              key={block.id}
              block={block}
              editable={blockEditable}
              onBlockCreated={handleBlockCreated}
              onBlockDeleted={handleBlockDeleted}
              allBlocks={blocks}
              saveBlocksToServer={saveBlocksToServer}
              onFocus={() => setFocusedBlockId(block.id)}
              onNavigateUp={() => {
                const prevBlock = getPreviousBlock(block.id);
                if (prevBlock) focusBlock(prevBlock.id, 'end');
              }}
              onNavigateDown={() => {
                const nextBlock = getNextBlock(block.id);
                if (nextBlock) focusBlock(nextBlock.id, 'start');
              }}
              onCreateBlockAfter={() => {
                const newBlock = createBlockBetween(block.id, getNextBlock(block.id)?.id);
                if (newBlock) {
                  handleBlockCreated(newBlock);
                  const updatedBlocks = [...blocks, newBlock].map((block, index) => ({
                    blockId: block.id,
                    blockType: block.blockType,
                    pageId: block.pageId,
                    content: {
                      ...block.content,
                      attrs: {
                        ...block.content.attrs,
                        position: index
                      }
                    }
                  }));
                  saveBlocksToServer(pageId, updatedBlocks);
                }
              }}
              onCreateBlockAtEnd={() => {
                const newBlock = createBlockAtEnd();
                if (newBlock) {
                  handleBlockCreated(newBlock);
                  const updatedBlocks = [...blocks, newBlock].map((block, index) => ({
                    blockId: block.id,
                    blockType: block.blockType,
                    pageId: block.pageId,
                    content: {
                      ...block.content,
                      attrs: {
                        ...block.content.attrs,
                        position: index
                      }
                    }
                  }));
                  saveBlocksToServer(pageId, updatedBlocks);
                }
              }}
              onDeleteBlock={() => handleBlockDeleted(block.id)}
              ref={(ref) => {
                if (ref) {
                  blockRefs.current.set(block.id, ref);
                } else {
                  blockRefs.current.delete(block.id);
                }
              }}
            />
          ) : (
            <PlaceholderBlock key={block.id} block={block} />
          );
        })
      )}
    </div>
  );
}
