import { withReadOnly } from './withReadOnly';
import { BlockType } from '../editor.namespace';
import { mainExtensions } from './extensions';
import { Extension } from '@tiptap/core';

export const EditableBlockTypes: BlockType [] = [
  BlockType.Paragraph,
  BlockType.Heading,
  BlockType.Blockquote,
  BlockType.CodeBlock,
  BlockType.CustomCodeBlock,
  BlockType.BulletList,
  BlockType.OrderedList,
  BlockType.ListItem,
  BlockType.TaskList,
  BlockType.TaskItem,
  BlockType.HorizontalRule,
  BlockType.Image,
  BlockType.Table,
  BlockType.TableRow,
  BlockType.TableCell,
  BlockType.TableHeader,
  BlockType.Iframe,
  BlockType.Figure,
  BlockType.N8N,
  BlockType.MathInline,
  BlockType.MathBlock,
  BlockType.Youtube,
  BlockType.TiptapVideo,
  BlockType.Selection,
  BlockType.Attachment,
  BlockType.Drawio,
  BlockType.Excalidraw,
  BlockType.Embed,
  BlockType.MarkdownClipboard,
];

export function getExtensionMap(extensions: Extension[]) {
    return Object.fromEntries(
      extensions.map((ext) => [ext.name, ext])
    );
  }

const extensionMap = getExtensionMap(mainExtensions);

export const readOnlyExtensions = EditableBlockTypes.map((type) => {
  const ext = extensionMap[type];
  return ext ? withReadOnly(ext) : null;
}).filter(Boolean);