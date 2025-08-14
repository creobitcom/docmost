import "@/features/editor/styles/index.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditor, EditorContent } from "@tiptap/react";
import { mainExtensions, collabExtensions, creobitExtentions } from "@/features/editor/extensions/extensions";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { useDebouncedCallback } from '@mantine/hooks';
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { yjsConnectionStatusAtom } from "./atoms/editor-atoms";

function getTokenFromCollabQuery(collabQuery: any): string | undefined {
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



 function BlockEditor({ block, editable, onBlockCreated, onBlockDeleted, allBlocks, saveBlocksToServer, pageId, syncPageOriginId }: { block: any, editable: boolean, onBlockCreated: (block: any) => void, onBlockDeleted: (blockId: string) => void, allBlocks: any[], saveBlocksToServer: (pageId: string, blocks: any[]) => void, pageId: string, syncPageOriginId?: string | null }) {
  const [currentUser] = useAtom(currentUserAtom);
  const ydoc = useMemo(() => new Y.Doc(), [block.id]);
  const collaborationURL = useCollaborationUrl();
  const documentName = syncPageOriginId
  ? `page.${syncPageOriginId}`
  : `page.${pageId}`;
  const { data: collabQuery } = useCollabToken();
  const [, setYjsConnectionStatus] = useAtom(yjsConnectionStatusAtom);
  const token = getTokenFromCollabQuery(collabQuery);
  if (!token) return null;

  // Гарантируем валидный контент - каждый блок содержит только один параграф
  let contentToInit;

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

  if (
    parsedContent &&
    typeof parsedContent === 'object' &&
    typeof parsedContent.type === 'string'
  ) {
    if (parsedContent.type === 'doc') {
      // Если это doc, берем все параграфы с уникальными blockId
      const paragraphs = parsedContent.content?.filter(node =>
        node.type === 'paragraph' && node.attrs?.blockId
      ) || [];

      if (paragraphs.length > 0) {
        contentToInit = {
          type: 'doc',
          content: paragraphs
        };
      } else {
        // Если нет параграфов с blockId, создаем пустой параграф
        contentToInit = {
          type: 'doc',
          content: [{ type: 'paragraph', content: [] }]
        };
      }
    } else if (parsedContent.type === 'paragraph') {
      // Если это параграф, оборачиваем в doc
      contentToInit = { type: 'doc', content: [parsedContent] };
    } else {
      // Оборачиваем одиночный узел в doc
      contentToInit = { type: 'doc', content: [parsedContent] };
    }
  } else {
    // Если контент пустой или null - создаем пустой параграф
    contentToInit = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: 'left' },
        content: []
      }]
    };
  }

  console.log('[BlockEditor] contentToInit:', contentToInit);

  const provider = useMemo(
    () =>
      new HocuspocusProvider({
        url: collaborationURL,
        name: `block.${block.id}`,
        document: ydoc,
        token,
      }),
    [block.id, collaborationURL, token]
  );

  const handleEditorUpdate = useDebouncedCallback((editor) => {
    const json = editor.getJSON();
    console.log('[BlockEditor] Editor JSON:', json);

    // Извлекаем все параграфы с уникальными blockId из текущего редактора
    const paragraphs = json.content?.filter(node =>
      node.type === 'paragraph' && node.attrs?.blockId
    ) || [];

    if (paragraphs.length > 0) {
      // Создаем обновленный список всех блоков страницы
      const updatedBlocks = allBlocks.map(existingBlock => {
        // Проверяем, соответствует ли текущий блок по blockId из HTML
        const currentBlockId = paragraphs[0]?.attrs?.blockId;
        const existingBlockId = existingBlock.id;

        // Если это текущий блок - обновляем его контент
        if (currentBlockId === existingBlockId) {
          return {
            blockId: existingBlockId,
            blockType: existingBlock.blockType,
            pageId: existingBlock.pageId,
            content: paragraphs[0] // Берем первый параграф как контент блока
          };
        }
        // Для остальных блоков оставляем как есть
        return {
          blockId: existingBlockId,
          blockType: existingBlock.blockType,
          pageId: existingBlock.pageId,
          content: existingBlock.content
        };
      });

      console.log('[BlockEditor] Saving all blocks:', updatedBlocks);
      saveBlocksToServer(block.pageId, updatedBlocks);
    }
  }, 2000);

  const extensions = useMemo(() => ([
    ...mainExtensions,
    ...collabExtensions(provider, currentUser?.user),
    ...creobitExtentions,
  ]), [provider, currentUser?.user]);

  const editor = useEditor({
    extensions,
    editable,
    content: contentToInit,
    editorProps: {
      attributes: {
        "data-block-id": block.id,
      },
      handleKeyDown: (view, event) => {
        const { state } = view;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Только для параграфов: Enter в конце параграфа создаёт новый блок
        if (
          event.key === 'Enter' &&
          parentType === 'paragraph' &&
          $from.parentOffset === $from.parent.content.size
        ) {
          event.preventDefault();

          // Создаем новый блок на клиенте
          const newBlock = {
            id: window.crypto.randomUUID(),
            pageId: block.pageId,
            blockType: 'paragraph',
            position: block.position + 1,
            content: {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                position: block.position + 1
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
            content: newBlock.content
          }];

          // Отправляем полный список блоков на сервер
          saveBlocksToServer(block.pageId, updatedBlocks);

          onBlockCreated(newBlock);
          return true;
        }

        // Для других типов блоков — стандартное поведение
        // Также стандартное поведение для Enter не в конце параграфа
        // (например, внутри списка, таблицы, кода и т.д.)
        return false;
      },
    },
    onUpdate({ editor }) {
      if (editor.isEmpty) return;
      handleEditorUpdate(editor);
    },
  });

  useEffect(() => () => provider.destroy(), [provider]);

  useEffect(() => {
    const yXmlFragment = ydoc.getXmlFragment("content");
    if (yXmlFragment.length === 0) {
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
      console.log('[BlockEditor][DIAG] tempFragment:', tempFragment);
      console.log('[BlockEditor][DIAG] nodes:', nodes);
      const validNodes = nodes.filter(
        node => node instanceof Y.XmlElement || node instanceof Y.XmlText
      );
      console.log('[BlockEditor][DIAG] validNodes:', validNodes);
      if (validNodes.length === 0) {
        // Вставляем пустой параграф, если нет валидных узлов
        const yParagraph = new Y.XmlElement('paragraph');
        yXmlFragment.insert(0, [yParagraph]);
      } else {
        yXmlFragment.insert(0, validNodes);
      }
    }
  }, [ydoc, contentToInit]);

  return (
    <>
      <EditorContent editor={editor} />
      {editor && <EditorBubbleMenu editor={editor} pageId={block.pageId} />}
    </>
  );
}

function PlaceholderBlock({ block }) {
  return (
    <div className="placeholder-block">
      🔒 Нет доступа к этому блоку (ID: {block.id})
    </div>
  );
}

export default function PageEditor({ pageId, editable, content, syncPageOriginId }) {
  const [blocks, setBlocks] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

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
      const initialBlock = {
        id: window.crypto.randomUUID(),
        pageId: pageId,
        blockType: 'paragraph',
        position: 0,
        content: {
          type: 'paragraph',
          attrs: {
            textAlign: 'left',
            position: 0
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
        content: initialBlock.content // Отправляем JSON объект, а не массив
      }]);

      setBlocks([initialBlock]);
    }
    setIsInitialized(true);
  }

  useEffect(() => {
    fetchBlocks();
  }, [pageId]);

  const handleBlockCreated = (newBlock) => {
    // Добавляем новый блок в состояние
    setBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      // Находим позицию для вставки
      const insertIndex = newBlocks.findIndex(block => block.position > newBlock.position);
      if (insertIndex === -1) {
        newBlocks.push(newBlock);
      } else {
        newBlocks.splice(insertIndex, 0, newBlock);
      }
      return newBlocks;
    });
  };

  const handleBlockDeleted = (blockId) => {
    setBlocks(prevBlocks => prevBlocks.filter(block => block.id !== blockId));
  };

  console.log('[PageEditor] Rendering blocks:', blocks);

  return (
    <div>
      {blocks.map((block) => {
        console.log('[PageEditor] Rendering block:', block.id, 'hasAccess:', block.hasAccess);
        return block.hasAccess ? (
          <BlockEditor
            pageId={pageId}
            key={block.id}
            block={block}
            editable={block.userPermission === "edit" || block.userPermission === "owner"}
            onBlockCreated={handleBlockCreated}
            onBlockDeleted={handleBlockDeleted}
            allBlocks={blocks}
            saveBlocksToServer={saveBlocksToServer}
          />
        ) : (
          <PlaceholderBlock key={block.id} block={block} />
        );
      })}
    </div>
  );
}
