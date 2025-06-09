import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';

export function withReadOnly(mainExtensions: any) {
  return mainExtensions.extend({
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleKeyDown: (view, event) => {
              const { selection } = view.state;
              const node = selection.$from.node();
              if (node.attrs?.userPermission === 'read') {
                event.preventDefault();
                return true;
              }
              return false;
            },
            handlePaste: (view, event) => {
              const { selection } = view.state;
              const node = selection.$from.node();
              if (node.attrs?.userPermission === 'read') {
                event.preventDefault();
                return true;
              }
              return false;
            },
          },
        }),
      ];
    },

    renderHTML({ HTMLAttributes }) {
      const className =
        HTMLAttributes.userPermission === 'read' ? 'read-only-block' : '';
      return [
        this.name,
        mergeAttributes(HTMLAttributes, { class: className }),
        0,
      ];
    },
  });
}
