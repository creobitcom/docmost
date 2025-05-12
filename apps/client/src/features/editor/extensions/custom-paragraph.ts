import { Node, mergeAttributes } from '@tiptap/core'

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
          return {
            'data-block-id': attributes.id,
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

  renderHTML: ({ HTMLAttributes, node }) => {
    const isEmpty = node.content.childCount === 0

    const attrs = { ...HTMLAttributes }

    if (isEmpty) {
      delete attrs['data-block-id']
    }

    return ['p', mergeAttributes(attrs), 0]
  }
})
