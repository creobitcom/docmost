import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { NodeSelection } from 'prosemirror-state'
import { BlockTypes } from '../editor.namespace'
import { ReadOnlyPlaceholderPlugin } from './ReadOnlyPlaceholderPlugin'

export const ReadOnlyBlockExtension = Extension.create({
  name: 'readOnlyBlock',

  addGlobalAttributes() {
    return [
      {
        types: BlockTypes,
        attributes: {
          userPermission: {
            default: null,
            parseHTML: element => element.getAttribute('data-user-permission'),
            renderHTML: attributes => {
              if (!attributes.userPermission) return {};
              return {
                'data-user-permission': attributes.userPermission,
              };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('readOnlyBlockPlugin'),
        props: {
          editable: state => {
            const { from, to } = state.selection
            let isReadOnly = false

            state.doc.nodesBetween(from, to, (node) => {
              if (node.attrs?.userPermission === 'read') {
                isReadOnly = true
                return false
              }
              return true
            })

            return !isReadOnly
          },

          handleDOMEvents: {
            dragstart: (view, event) => {
              const pos = view.posAtDOM(event.target as Node, 0)
              const $pos = view.state.doc.resolve(pos)

              const node = $pos.nodeAfter || $pos.nodeBefore
              if (node?.attrs?.userPermission === 'read') {
                event.preventDefault()
                return true
              }
              return false
            },
          },

          attributes: {
            class: 'tiptap-read-only-context',
          },
        },
      }),
      ReadOnlyPlaceholderPlugin,
    ]
  },
})
