import { Plugin, PluginKey } from 'prosemirror-state'
import { Node as ProseMirrorNode } from 'prosemirror-model'

export enum BlockType {
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
}
export const BlockTypes = Object.values(BlockType);

export const UpdateBlockPositions = new Plugin({
  key: new PluginKey('updateBlockPositionsPlugin'),

  appendTransaction(transactions, oldState, newState) {
    if (!transactions.some(tr => tr.docChanged)) return;

    const tr = newState.tr;
    let modified = false;

    newState.doc.content.forEach((node: ProseMirrorNode, offset: number, index: number) => {
      const currentPos = node.attrs?.position;
      if (currentPos !== index) {
        const pos = tr.mapping.map(offset + 1)
        tr.setNodeMarkup(pos - 1, undefined, {
          ...node.attrs,
          position: index,
        })
        modified = true;
      }
    })
    
    return modified ? tr : null;
  },
})
