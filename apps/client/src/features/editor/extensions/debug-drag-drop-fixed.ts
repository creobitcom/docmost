import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface DebugDragDropFixedOptions {
  HTMLAttributes: Record<string, any>;
  enableLogging?: boolean;
}

export const DebugDragDropFixed = Extension.create<DebugDragDropFixedOptions>({
  name: 'debugDragDropFixed',

  addOptions() {
    return {
      HTMLAttributes: {},
      enableLogging: true,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('debugDragDropFixed'),
        props: {
          decorations: (state) => {
            return createDebugDecorations(state.doc, this.options);
          },
          handleDOMEvents: {
            dragstart: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[DebugDragDropFixed] Drag start:', {
                  target: event.target,
                  dataTransfer: event.dataTransfer,
                  types: event.dataTransfer?.types,
                });
              }
              return false;
            },
            dragover: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[DebugDragDropFixed] Drag over:', {
                  target: event.target,
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              }
              return false;
            },
            drop: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[DebugDragDropFixed] Drop:', {
                  target: event.target,
                  dataTransfer: event.dataTransfer,
                  types: event.dataTransfer?.types,
                  data: event.dataTransfer?.getData('text/plain'),
                });
              }
              return false;
            },
            dragend: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[DebugDragDropFixed] Drag end:', {
                  target: event.target,
                });
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

function createDebugDecorations(doc: any, options: DebugDragDropFixedOptions) {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
        const decoration = Decoration.widget(pos, () => {
          const handle = document.createElement('div');
          handle.className = 'debug-drag-handle';
          handle.setAttribute('draggable', 'true');
          handle.style.cssText = `
            position: absolute;
            left: -30px;
            top: 0px;
            width: 20px;
            height: 20px;
            cursor: grab;
            background: #ef4444;
            border: 2px solid #ffffff;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            z-index: 9999;
            user-select: none;
            opacity: 0.8;
            transition: opacity 0.2s ease;
            pointer-events: auto;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          `;
          handle.innerHTML = '⋮⋮';
          handle.title = 'Debug: Перетащите элемент';

          handle.addEventListener('dragstart', (e) => {
            const elementId = `element-${pos}-${node.type.name}`;
            const payload = {
              type: 'element',
              elementId,
              sourceBlockId: 'debug-block'
            };
            
            e.dataTransfer?.setData('application/json', JSON.stringify(payload));
            e.dataTransfer?.setData('text/plain', JSON.stringify(payload));
            
            if (options.enableLogging) {
              console.log('[DebugDragDropFixed] Drag start on handle:', {
                elementId,
                payload,
                node: node.type.name,
                pos
              });
            }
          });

          return handle;
        }, {
          side: -1,
          key: `debug-drag-handle-${pos}`,
        });

        decorations.push(decoration);
      }
    });

    return DecorationSet.create(doc, decorations);
}
