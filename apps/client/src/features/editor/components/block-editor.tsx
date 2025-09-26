import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef, memo, useImperativeHandle } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  onAuthenticationFailedParameters,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { EditorContent, EditorProvider, useEditor } from "@tiptap/react";
// import { LarkEditorWrapper } from "@/features/editor/components/drag-handle/lark-editor-wrapper";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { useDebouncedCallback } from '@mantine/hooks';
import { yjsConnectionStatusAtom } from "../atoms/editor-atoms";
import {
  collabExtensions,
  creobitExtentions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { createFlexibleContent } from "@/features/editor/extensions/flexible-document";
import { SmartListHandler } from "@/features/editor/extensions/smart-list-handler";
import { slashMenuPluginKey } from "@/features/editor/extensions/slash-command";
import { getTokenFromCollabQuery, saveBlocksToServer, hasTextContent } from "../utils/block-utils";
// Удалена старая логика обязательного первого блока

// Объявляем глобальные переменные для TypeScript
declare global {
  interface Window {
    __currentBlockId?: string;
  }
}

interface BlockEditorProps {
  block: any;
  editable: boolean;
  onBlockCreated: (block: any) => void;
  onBlockDeleted: (blockId: string) => void;
  allBlocks: any[];
  saveBlocksToServer: (pageId: string, blocks: any[]) => void;
  pageId: string;
  syncPageOriginId?: string | null;
  onFocus?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateToFirst?: () => void;
  onNavigateToLast?: () => void;
  onCreateBlockAfter?: () => void;
  onCreateBlockAtEnd?: () => void;
  onDeleteBlock?: () => void;
}

export const BlockEditor = forwardRef<{ editor: any; provider: any }, BlockEditorProps>(({
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
  onNavigateToFirst,
  onNavigateToLast,
  onCreateBlockAfter,
  onCreateBlockAtEnd,
  onDeleteBlock
}, ref) => {

  // Логи монтажа отключены для упрощения отладки
  // console.log('[BlockEditor] 🚀 MOUNTING BlockEditor for block:', block.id, {
  //   editable,
  //   hasRef: !!ref,
  //   blockType: block.blockType,
  //   position: block.position
  // });

  const [currentUser] = useAtom(currentUserAtom);
  const ydoc = useMemo(() => new Y.Doc(), [block.id]);
  const collaborationURL = useCollaborationUrl();

  // Отслеживание монтирования компонента - логи отключены
  // useEffect(() => {
  //   console.log('[BlockEditor] 🎯 MOUNTED BlockEditor for block:', block.id);
  //   return () => {
  //     console.log('[BlockEditor] 🗑️ UNMOUNTING BlockEditor for block:', block.id);
  //   };
  // }, [block.id]);

  const documentName = syncPageOriginId
    ? `page.${syncPageOriginId}`
    : `page.${pageId}`;
  const { data: collabQuery, isLoading: tokenLoading } = useCollabToken();
  const [, setYjsConnectionStatus] = useAtom(yjsConnectionStatusAtom);
  const token = getTokenFromCollabQuery(collabQuery);


  // Если токен загружается, показываем загрузку
  if (tokenLoading) {
    return <div>Загрузка редактора...</div>;
  }

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


  // Гарантируем валидный контент - обрабатываем разные типы блоков
  let contentToInit;

  if (
    parsedContent &&
    typeof parsedContent === 'object' &&
    typeof parsedContent.type === 'string'
  ) {
    if (parsedContent.type === 'doc') {
      // Проверяем тип блока для правильной обработки
      const blockType = block.blockType || 'paragraph';
      const isListBlock = blockType.includes('List') || blockType.includes('list') || blockType.includes('task');

      if (isListBlock) {
        // Для блоков-списков берем весь контент как есть, не фильтруем параграфы
        contentToInit = createFlexibleContent(
          parsedContent.content?.map(node => ({
            ...node,
            attrs: {
              ...node.attrs,
              position: block.position,
              blockId: block.id
            }
          })) || []
        );
      } else {
        // Для обычных блоков берем только первый параграф
        const paragraphs = parsedContent.content?.filter(node =>
          node.type === 'paragraph'
        ) || [];

        if (paragraphs.length > 0) {
          // Берем только первый параграф и добавляем метаданные
          const firstParagraph = paragraphs[0];
          // Проверяем, что параграф не пустой
          if (hasTextContent(firstParagraph)) {
            // Гарантируем, что создается только один параграф
            contentToInit = createFlexibleContent([{
              ...firstParagraph,
              attrs: {
                ...firstParagraph.attrs,
                position: block.position,
                blockId: block.id
              }
            }]);
          } else {
            // Если параграф пустой, не создаем контент вообще
            contentToInit = createFlexibleContent();
          }
        } else {
          // Если нет параграфов, не создаем контент вообще
          contentToInit = createFlexibleContent();
        }
      }
    } else if (parsedContent.type === 'paragraph') {
      // Если это параграф, проверяем что он не пустой
      if (hasTextContent(parsedContent)) {
        contentToInit = createFlexibleContent([{
          ...parsedContent,
          attrs: {
            ...parsedContent.attrs,
            position: block.position,
            blockId: block.id
          }
        }]);
      } else {
        // Если параграф пустой, не создаем контент
        contentToInit = createFlexibleContent();
      }
    } else {
      // Оборачиваем одиночный узел в doc только если он не пустой
      if (hasTextContent(parsedContent)) {
        contentToInit = createFlexibleContent([{
          ...parsedContent,
          attrs: {
            ...parsedContent.attrs,
            position: block.position,
            blockId: block.id
          }
        }]);
      } else {
        // Если узел пустой, не создаем контент
        contentToInit = createFlexibleContent();
      }
    }
  } else {
    // Если контент пустой или null - не создаем контент вообще
    contentToInit = createFlexibleContent();
  }


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

    // Проверяем тип блока для правильной обработки
    const blockType = block.blockType || 'paragraph';
    const isListBlock = blockType.includes('List') || blockType.includes('list') || blockType.includes('task');

    let contentToSave = null;

    if (isListBlock) {
      // Для списков берем весь контент как есть
      contentToSave = json;
    } else {
      // Для обычных блоков берем только первый параграф
      const firstParagraph = json.content?.find(node =>
        node.type === 'paragraph'
      );

      if (firstParagraph && hasTextContent(firstParagraph)) {
        contentToSave = firstParagraph;
      } else {
        // Если нет валидного параграфа, не сохраняем контент
        contentToSave = null;
      }
    }

    // Проверяем, что контент не пустой
    if (contentToSave) {
      // Проверяем валидность контента перед отправкой
      const isValidContent = (node) => {
        if (!node || typeof node !== 'object') return false;
        if (!node.type || typeof node.type !== 'string') return false;
        if (node.content && Array.isArray(node.content)) {
          return node.content.every(isValidContent);
        }
        return true;
      };

      if (!isValidContent(contentToSave)) {
        console.warn('[BlockEditor] Invalid content detected, skipping save');
        return;
      }

      // Проверяем, что в контенте нет дублирующихся blockId
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

      if (!checkForDuplicateBlockIds(contentToSave)) {
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
              ...contentToSave,
              attrs: {
                ...contentToSave.attrs,
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

      saveBlocksToServer(block.pageId, updatedBlocks);
    }
  }, 1000); // Уменьшили дебаунс с 2000ms до 1000ms для более быстрого сохранения

  const extensions = useMemo(() => {
    const baseExtensions = [...mainExtensions, ...creobitExtentions];

    // Заменяем SmartListHandler на версию с колбэком создания блока
    const customExtensions = baseExtensions.map(extension => {
      if (extension.name === 'smartListHandler') {
        return SmartListHandler.configure({
          onCreateBlockAfter: onCreateBlockAfter
        });
      }
      // Настраиваем ComprehensiveKeyboardHandler с правильными опциями
      if (extension.name === 'comprehensiveKeyboardHandler') {
        return extension.configure({
          onCreateBlockAfter: onCreateBlockAfter,
          onDeleteBlock: onDeleteBlock,
          onNavigateUp: onNavigateUp,
          onNavigateDown: onNavigateDown,
          onNavigateToFirst: onNavigateToFirst,
          onNavigateToLast: onNavigateToLast,
          canDeleteBlock: (block: any, allBlocks: any[]) => allBlocks.length > 1,
          allBlocks: allBlocks,
          currentBlock: block
        });
      }
      return extension;
    });

    // Временно отключаем DragDropExtension для диагностики
    // const finalExtensions = [...customExtensions, DragDropExtension];
    const finalExtensions = [...customExtensions];

    // Добавляем коллаборационные расширения только если есть провайдер
    if (provider) {
      return [...finalExtensions, ...collabExtensions(provider, currentUser?.user)];
    }

    return finalExtensions;
  }, [provider, currentUser?.user, onCreateBlockAfter, onDeleteBlock, onNavigateUp, onNavigateDown, onNavigateToFirst, onNavigateToLast, allBlocks, block]);


  // Устанавливаем глобальный blockId для ElementDragHandle
  useEffect(() => {
    window.__currentBlockId = block.id;

    return () => {
      window.__currentBlockId = undefined;
    };
  }, [block.id]);

  const editor = useEditor({
    extensions,
    editable,
    content: contentToInit || createFlexibleContent(),
    editorProps: {
      attributes: {
        "data-block-id": block.id,
      },
      handleKeyDown: (view, event) => {
        // Теперь основная логика обработки клавиш перенесена в ComprehensiveKeyboardHandler
        // Здесь оставляем только специфичную логику, если она нужна

        // Для остальных случаев — стандартное поведение
        return false;
      },
    },
    onCreate({ editor }) {
      console.log('🎯 [BlockEditor] Editor created for block:', block.id);
      console.log('🎯 [BlockEditor] Extensions loaded:', extensions.map(ext => ext.name));

      // Проверяем тип блока для правильной обработки
      const blockType = block.blockType || 'paragraph';
      const isListBlock = blockType.includes('List') || blockType.includes('list') || blockType.includes('task');

      if (!isListBlock) {
        // Для обычных блоков проверяем, что в редакторе только один параграф
        try {
          const doc = editor.getJSON();
          if (doc.content && doc.content.length > 1) {
            const paragraphs = doc.content.filter(node => node.type === 'paragraph');
            if (paragraphs.length > 1) {
              console.warn('[BlockEditor] Multiple paragraphs detected in editor after creation, keeping only first');
              const firstParagraph = paragraphs[0];
              const otherContent = doc.content.filter(node => node.type !== 'paragraph');
              editor.commands.setContent({
                type: 'doc',
                content: [firstParagraph, ...otherContent]
              });
            }
          }
        } catch (error) {
          console.warn('[BlockEditor] Error in onCreate:', error);
        }
      }

      // Принудительно вызываем ref callback после создания редактора
      if (ref && typeof ref === 'function') {
        ref({ editor, provider });
      }
    },
    onUpdate({ editor }) {
      if (editor.isEmpty) return;

      try {
        // Проверяем тип блока для правильной обработки
        const blockType = block.blockType || 'paragraph';
        const isListBlock = blockType.includes('List') || blockType.includes('list') || blockType.includes('task');

        if (!isListBlock) {
          // Для обычных блоков проверяем, что в редакторе только один параграф
          const doc = editor.getJSON();
          if (doc.content && doc.content.length > 1) {
            const paragraphs = doc.content.filter(node => node.type === 'paragraph');
            if (paragraphs.length > 1) {
              console.warn('[BlockEditor] Multiple paragraphs detected in editor update, keeping only first');
              const firstParagraph = paragraphs[0];
              const otherContent = doc.content.filter(node => node.type !== 'paragraph');
              editor.commands.setContent({
                type: 'doc',
                content: [firstParagraph, ...otherContent]
              });
            }
            return;
          }
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

  // useEffect для обновления ref при изменении editor/provider
  useEffect(() => {
    if (editor && provider && ref) {
      // Вызываем функцию ref с объектом { editor, provider }
      if (typeof ref === 'function') {
        ref({ editor, provider });
      } else if (ref && 'current' in ref) {
        (ref as any).current = { editor, provider };
      }
    }
  }, [editor, provider, ref, block.id]);

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

    // Убрали переопределение console.error для предотвращения рекурсии
    // const originalConsoleError = console.error;
    // const yjsErrorHandler = (...args) => {
    //   if (args[0] && typeof args[0] === 'string' && args[0].includes('Method unimplemented')) {
    //     // Подавляем ошибку Y.js
    //     return;
    //   }
    //   originalConsoleError.apply(console, args);
    // };

    // Устанавливаем глобальный обработчик
    // console.error = yjsErrorHandler;

    // Убрали переопределение window.onerror для предотвращения рекурсии
    // const originalWindowError = window.onerror;
    // window.onerror = (message, source, lineno, colno, error) => {
    //   if (message && typeof message === 'string' && message.includes('Method unimplemented')) {
    //     return true; // Подавляем ошибку
    //   }
    //   if (originalWindowError) {
    //     return originalWindowError(message, source, lineno, colno, error);
    //   }
    //   return false;
    // };

    const yXmlFragment = ydoc.getXmlFragment("content");

    // Проверяем, есть ли уже контент в Y.js документе
    if (yXmlFragment.length > 0) {
      return;
    }

    if (yXmlFragment.length === 0) {
      // Если contentToInit равен null, не инициализируем Y.js документ
      if (!contentToInit) {
        return;
      }

      // Используем requestAnimationFrame для синхронизации с DOM
      requestAnimationFrame(() => {
        try {
          // Проверяем тип блока для правильной обработки
          const blockType = block.blockType || 'paragraph';
          const isListBlock = blockType.includes('List') || blockType.includes('list') || blockType.includes('task');

          if (!isListBlock) {
            // Для обычных блоков проверяем, что contentToInit содержит только один параграф
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


          // Проверяем, есть ли контент в блоке
          if (validNodes.length === 0 && !hasTextContent(contentToInit)) {
            // Проверяем, является ли блок списком
            const isListBlock = block.blockType.includes('List') || block.blockType.includes('list') || block.blockType.includes('task');

            if (isListBlock) {
              console.log('[BlockEditor] List block is empty, not creating empty paragraph');
              // Для списков не создаем пустой параграф, если список пустой
            } else {
              // Создаем пустой параграф только для обычных блоков
              console.log('[BlockEditor] Block is empty, creating empty paragraph');
              const yParagraph = new Y.XmlElement('paragraph');
              yXmlFragment.insert(0, [yParagraph]);
            }
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
              // Если тип не поддерживается, создаем пустой параграф только для обычных блоков
              const isListBlock = block.blockType.includes('List') || block.blockType.includes('list') || block.blockType.includes('task');

              if (isListBlock) {
                console.log('[BlockEditor] Unsupported node type in list block, not creating empty paragraph');
              } else {
                console.log('[BlockEditor] Unsupported node type, creating empty paragraph');
                const yParagraph = new Y.XmlElement('paragraph');
                yXmlFragment.insert(0, [yParagraph]);
              }
            }
          }
          // Если validNodes.length === 0, но есть текстовый контент, не создаем пустой параграф
        } catch (error) {
          console.error('[BlockEditor] Error during Y.js initialization:', error);
          // В случае ошибки создаем пустой параграф только для обычных блоков
          const isListBlock = block.blockType.includes('List') || block.blockType.includes('list') || block.blockType.includes('task');

          if (isListBlock) {
            console.log('[BlockEditor] Error occurred in list block, not creating empty paragraph as fallback');
          } else {
            console.log('[BlockEditor] Error occurred, creating empty paragraph as fallback');
            const yParagraph = new Y.XmlElement('paragraph');
            yXmlFragment.insert(0, [yParagraph]);
          }
        } finally {
          // Убрали восстановление originalConsoleError
          // console.error = originalConsoleError;
        }
      });
    }

    // Cleanup функция для восстановления обработчиков ошибок
    return () => {
      // Убрали восстановление обработчиков ошибок
      // console.error = originalConsoleError;
      // window.onerror = originalWindowError;
    };
  }, [ydoc, contentToInit, provider, extensions]);



  return (
    <>
      <div
        style={{ position: 'relative' }}
        data-block-id={block.id}
        className="block-editor-container"
      >
        {/* <LarkEditorWrapper editor={editor}> */}
          {editor && <EditorContent editor={editor} />}
          {editor && <EditorBubbleMenu editor={editor} pageId={block.pageId} blockId={block.id} />}
        {/* </LarkEditorWrapper> */}
      </div>
    </>
  );
});

BlockEditor.displayName = 'BlockEditor';

