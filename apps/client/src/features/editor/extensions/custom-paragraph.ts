import { Extension } from '@tiptap/core'
import { v4 as uuidv4 } from 'uuid'

export const BlockAttributes = Extension.create({
  name: 'blockAttributes',

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
            default: null,
            parseHTML: element => element.getAttribute('blockId'),
            renderHTML: attributes => ({
              blockId: attributes.blockId,
            }),
          },
          position: {
            default: null,
            parseHTML: element => element.getAttribute('position'),
            renderHTML: attributes => ({
              position: attributes.position,
            }),
          },
        },
      },
    ]
  },
})
