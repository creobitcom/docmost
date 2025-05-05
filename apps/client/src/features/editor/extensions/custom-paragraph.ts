import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuidv4 } from 'uuid'

export const CustomParagraph = Node.create({
  name: 'paragraph',

  group: 'block',
  content: 'inline*',
  draggable: false,
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          const id = attributes.id || uuidv4()
          return {
            'data-block-id': id,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'p',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0]
  },
})
