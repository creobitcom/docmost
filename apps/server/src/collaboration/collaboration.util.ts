import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Youtube } from '@tiptap/extension-youtube';
import Table from '@tiptap/extension-table';
import TableHeader from '@tiptap/extension-table-header';
import {
  Callout,
  Comment,
  CustomCodeBlock,
  Details,
  DetailsContent,
  DetailsSummary,
  LinkExtension,
  MathBlock,
  MathInline,
  TableCell,
  TableRow,
  TiptapImage,
  TiptapVideo,
  TrailingNode,
  Attachment,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  BlockGroup,
  BlockId,
  BlockPosition,
  NoAccessExtension,
} from '@docmost/editor-ext';
import { generateText, getSchema, JSONContent } from '@tiptap/core';
import { generateHTML } from '../common/helpers/prosemirror/html';
// @tiptap/html library works best for generating prosemirror json state but not HTML
// see: https://github.com/ueberdosis/tiptap/issues/5352
// see:https://github.com/ueberdosis/tiptap/issues/4089
import { generateJSON } from '@tiptap/html';
import { Node } from '@tiptap/pm/model';

export const mainExtensions = [
  StarterKit.configure({
    codeBlock: false,
  }),
  Comment,
  TextAlign,
  TaskList,
  TaskItem,
  Underline,
  LinkExtension,
  Superscript,
  SubScript,
  Highlight,
  Typography,
  TrailingNode,
  TextStyle,
  Color,
  MathInline,
  MathBlock,
  Details,
  DetailsContent,
  DetailsSummary,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  Youtube,
  TiptapImage,
  TiptapVideo,
  Callout,
  Attachment,
  CustomCodeBlock,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  BlockGroup,
] as any;

enum BlockType {
  Paragraph = 'paragraph',
  Heading = 'heading',
  Blockquote = 'blockquote',
  CodeBlock = 'codeBlock',
  BulletList = 'bulletList',
  OrderedList = 'orderedList',
  ListItem = 'listItem',
  TaskList = 'taskList',
  TaskItem = 'taskItem',
  HorizontalRule = 'horizontalRule',
  Image = 'image',
  Table = 'table',
  TableRow = 'tableRow',
  TableCell = 'tableCell',
  TableHeader = 'tableHeader',
  Iframe = 'iframe',
  Figure = 'figure',
  N8N = 'n8n',
  StarterKit = 'starterKit',
  Placeholder = 'placeholder',
  TextAlign = 'textAlign',
  Underline = 'underline',
  LinkExtension = 'link',
  Superscript = 'superscript',
  SubScript = 'subscript',
  Highlight = 'highlight',
  Typography = 'typography',
  TrailingNode = 'trailingNode',
  GlobalDragHandle = 'globalDragHandle',
  TextStyle = 'textStyle',
  Color = 'color',
  SlashCommand = 'slashCommand',
  EmojiCommand = 'emojiCommand',
  Comment = 'comment',
  Mention = 'mention',
  MathInline = 'mathInline',
  MathBlock = 'mathBlock',
  Details = 'details',
  DetailsSummary = 'detailsSummary',
  DetailsContent = 'detailsContent',
  Youtube = 'youtube',
  TiptapVideo = 'video',
  Callout = 'callout',
  CustomCodeBlock = 'customCodeBlock',
  Selection = 'selection',
  Attachment = 'attachment',
  Drawio = 'drawio',
  Excalidraw = 'excalidraw',
  Embed = 'embed',
  MarkdownClipboard = 'markdownClipboard',
  CharacterCount = 'characterCount',
  BlockGroup = 'blockGroup',
}
const BlockTypes = Object.values(BlockType);

export const creobitExtentions = [
  NoAccessExtension.configure({
    types: ['paragraph'],
  }),
  BlockId.configure({
    attributeName: 'blockId',
    types: BlockTypes,
    createId: () => window.crypto.randomUUID(),
  }),
  BlockPosition.configure({
    types: BlockTypes,
  }),
] as any;

export const tiptapExtensions = [...mainExtensions, ...creobitExtentions];

export function jsonToHtml(tiptapJson: any) {
  return generateHTML(tiptapJson, tiptapExtensions);
}

export function htmlToJson(html: string) {
  return generateJSON(html, tiptapExtensions);
}

export function jsonToText(tiptapJson: JSONContent) {
  return generateText(tiptapJson, tiptapExtensions);
}

export function jsonToNode(tiptapJson: JSONContent) {
  return Node.fromJSON(getSchema(tiptapExtensions), tiptapJson);
}

export function getPageId(documentName: string) {
  return documentName.split('.')[1];
}
