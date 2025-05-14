import { Extension } from '@tiptap/core'
import { v4 as uuidv4 } from 'uuid'

export const BlockAttributes = Extension.create({
  name: 'blockAttributes',

  addGlobalCommands() {
    return {
      types: [
        'paragraph',
        'heading',
        'blockquote',
        'codeBlock',
        'bulletList',
        'orderedList',
        'listItem',
        'taskList',
        'taskItem',
        'horizontalRule',
        'image',
        'table',
        'tableRow',
        'tableCell',
        'tableHeader',
        'iframe',
        'figure',
      ],
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
        types: [
          /*'paragraph',
          'heading',
          'blockquote',
          'codeBlock',
          'bulletList',
          'orderedList',
          'listItem',
          'taskList',
          'taskItem',
          'horizontalRule',
          'image',
          'table',
          'tableRow',
          'tableCell',
          'tableHeader',
          'iframe',
          'figure',*/
        ],
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
            default: Math.floor(Math.random() * 10000) + 1,
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
