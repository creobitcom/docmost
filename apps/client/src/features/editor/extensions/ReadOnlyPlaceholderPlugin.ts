import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const ReadOnlyPlaceholderPlugin = new Plugin({
  key: new PluginKey('readOnlyPlaceholderPlugin'),

  props: {
    decorations(state) {
      const decorations: Decoration[] = []
      const doc = state.doc
      const lastNode = doc.lastChild

      if (!lastNode) return null

      const pos = doc.content.size - lastNode.nodeSize
      const isEmptyParagraph =
        lastNode.type.name === 'paragraph' && lastNode.content.size === 0

      const isReadOnly =
        !lastNode.attrs.userPermission ||
        ['read', 'none'].includes(lastNode.attrs.userPermission)

      if (isEmptyParagraph && isReadOnly) {
        decorations.push(
          Decoration.node(pos, pos + lastNode.nodeSize, {
            class: 'read-only-hidden-paragraph',
            contenteditable: 'false',
            'aria-hidden': 'true',
          })
        )
      }

      return DecorationSet.create(doc, decorations)
    },
  },
})
