import { Extension } from '@tiptap/core'
import { v4 as uuidv4 } from 'uuid'

export enum BlockNodeType {
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
}
export const allNodeTypes: BlockNodeType[] = Object.values(BlockNodeType);

export const BlockAttributes = Extension.create({
  name: 'blockAttributes',

  addGlobalCommands() {
    return {
      types: allNodeTypes,
      onCreate:
        (attrs: any) =>
        ({ commands }) => {
          return commands.insertContent({
            attrs: { ...attrs, "huetaNEW": () => uuidv4() },
          });
        },
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: allNodeTypes,
        attributes: {
          blockId: {
            // default: () => uuidv4(),
            default: null,
            parseHTML: (element) => {
              console.log(`[blockID]`);
              console.log(element);
              return element.getAttribute('blockId')
            },
            renderHTML: (attributes) => ({
              blockId: attributes.blockId,
            }),
          },
          position: {
            parseHTML: (element) => element.getAttribute('position'),
            renderHTML: (attributes) => ({
              position: attributes.position,
            }),
          },
        },
        commands: {
          setBlockId:
            (attrs: any) =>
            ({ commands }) => {
              return commands.setNode('paragraph', attrs);
            },
          onCreate:
            (attrs: any) =>
            ({ commands }) => {
              return commands.insertContent({
                attrs: { ...attrs, "huetaNEW2": () => uuidv4() },
              });
            },
        }

    },]
  },
})
