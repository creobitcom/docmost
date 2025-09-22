import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface ElementDragHandleSimpleOptions {
  HTMLAttributes: Record<string, any>;
}

export const ElementDragHandleSimple = Extension.create<ElementDragHandleSimpleOptions>({
  name: 'elementDragHandleSimple',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('elementDragHandleSimple'),
        props: {
          decorations: (state) => {
            return createElementDecorations(state.doc, this.options);
          },
        },
      }),
    ];
  },
});

function createElementDecorations(doc: any, options: ElementDragHandleSimpleOptions) {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
        const decoration = Decoration.widget(pos, () => {
          const handle = document.createElement('div');
          handle.className = 'element-drag-handle-simple';
          handle.setAttribute('draggable', 'true');
          handle.style.cssText = `
            position: absolute;
            left: -25px;
            top: 0px;
            width: 16px;
            height: 16px;
            cursor: grab;
            background: #10b981;
            border: 1px solid #ffffff;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            opacity: 0.7;
            transition: opacity 0.2s ease;
          `;
          handle.innerHTML = '⋮';
          handle.title = 'Перетащите элемент';

          handle.addEventListener('mouseenter', () => {
            handle.style.opacity = '1';
          });

          handle.addEventListener('mouseleave', () => {
            handle.style.opacity = '0.7';
          });

          handle.addEventListener('dragstart', (e) => {
            const elementId = `element-${pos}-${node.type.name}`;
            const payload = {
              type: 'element',
              elementId,
              sourceBlockId: 'current-block'
            };
            
            e.dataTransfer?.setData('application/json', JSON.stringify(payload));
            e.dataTransfer?.setData('text/plain', JSON.stringify(payload));
          });

          return handle;
        }, {
          side: -1,
          key: `element-drag-handle-simple-${pos}`,
        });

        decorations.push(decoration);
      }
    });

    return DecorationSet.create(doc, decorations);
}
