import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface BlockDragHandleOptions {
  HTMLAttributes: Record<string, any>;
  dragHandleWidth?: number;
  showOnHover?: boolean;
}

export const BlockDragHandle = Extension.create<BlockDragHandleOptions>({
  name: 'blockDragHandle',

  addOptions() {
    return {
      HTMLAttributes: {},
      dragHandleWidth: 24,
      showOnHover: true,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockDragHandle'),
        props: {
          decorations: (state) => {
            return createBlockDecorations(state.doc, this.options);
          },
        },
      }),
    ];
  },
});

function createBlockDecorations(doc: any, options: BlockDragHandleOptions) {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        const decoration = Decoration.widget(pos, () => {
          const handle = document.createElement('div');
          handle.className = 'block-drag-handle';
          handle.setAttribute('draggable', 'true');
          handle.style.cssText = `
            position: absolute;
            left: -30px;
            top: 0px;
            width: ${options.dragHandleWidth}px;
            height: 20px;
            cursor: grab;
            background: #3b82f6;
            border: 2px solid #ffffff;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
          `;
          handle.innerHTML = '⋮⋮';
          handle.title = 'Перетащите блок';

          handle.addEventListener('dragstart', (e) => {
            const blockId = `block-${pos}-${node.type.name}`;
            e.dataTransfer?.setData('application/block-id', blockId);
            e.dataTransfer?.setData('text/plain', `block-${blockId}`);
          });

          return handle;
        }, {
          side: -1,
          key: `block-drag-handle-${pos}`,
        });

        decorations.push(decoration);
      }
    });

    return DecorationSet.create(doc, decorations);
}
