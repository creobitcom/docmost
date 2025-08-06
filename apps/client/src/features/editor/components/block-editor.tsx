import React, { useEffect, useMemo, useState } from "react";
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

export function BlockEditor({ block, editable, onBlockUpdate }: BlockEditorProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const collaborationURL = useCollaborationUrl();
  const { data: collabQuery } = useCollabToken();
  
  // Создаем отдельный YDoc для каждого блока
  const ydoc = useMemo(() => new Y.Doc(), [block.id]);
  
  // Создаем HocuspocusProvider для блока
  const provider = useMemo(() => {
    const token = collabQuery?.token;
    if (!token) return null;

    return new HocuspocusProvider({
      url: collaborationURL,
      name: `block.${block.id}.${block.pageId}`, // Формат: block.{blockId}.{pageId}
      document: ydoc,
      token,
      connect: false,
      preserveConnection: false,
    });
  }, [block.id, block.pageId, collaborationURL, collabQuery?.token, ydoc]);

  // Подключаемся к серверу
  useEffect(() => {
    if (provider) {
      provider.connect();
      return () => {
        provider.destroy();
      };
    }
  }, [provider]);

  // Инициализируем контент блока
  const initializeBlockContent = useMemo(() => {
    if (!block.content) {
      // Если контента нет, создаем пустой параграф
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

    // Если контент есть, нормализуем его
    let normalizedContent;
    if (typeof block.content === 'string') {
      try {
        normalizedContent = JSON.parse(block.content);
      } catch (e) {
        console.warn('Failed to parse block content:', block.content);
        normalizedContent = null;
      }
    } else {
      normalizedContent = block.content;
    }

    // Убеждаемся, что контент имеет правильную структуру
    if (normalizedContent && normalizedContent.content && Array.isArray(normalizedContent.content)) {
      // Устанавливаем blockId для всех элементов контента
      const contentWithBlockId = normalizedContent.content.map((node: any) => ({
        ...node,
        attrs: { ...node.attrs, blockId: block.id }
      }));

      return {
        ...normalizedContent,
        content: contentWithBlockId
      };
    }

    // Fallback: создаем параграф с blockId
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

    // Извлекаем только первый элемент контента (содержимое блока)
    const blockContent = editorJson.content?.[0] || null;
    
    if (blockContent) {
      debouncedUpdateBlock(blockContent);
    }
  };

  // Настройка расширений для блока
  const extensions = useMemo(() => {
    if (!provider) return [];

    return [
      ...mainExtensions,
      ...collabExtensions(provider, currentUser?.user),
      // Используем creobitExtentions без BlockId, так как мы настроим его отдельно для каждого блока
      ...creobitExtentions.filter(ext => ext.name !== 'block-id'),
      // Настраиваем BlockId специально для этого блока
      BlockId.configure({
        attributeName: "blockId",
        types: ['paragraph', 'heading', 'block'],
        createId: () => {
          // Проверяем, является ли block.id валидным UUID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const result = uuidRegex.test(block.id) ? block.id : window.crypto.randomUUID();
          return result as `${string}-${string}-${string}-${string}-${string}`;
        },
      }),
    ];
  }, [provider, currentUser?.user, block.id]);

  const editor = useEditor({
    extensions,
    editable,
    content: initializeBlockContent,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
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
        editor.storage.pageId = block.pageId;
        editor.storage.blockId = block.id;
      }
    },
    onUpdate: handleEditorUpdate,
  }, [block.id, block.pageId, editable, initializeBlockContent, provider?.status]);



  if (!provider || !editor) {
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
        Загрузка блока...
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