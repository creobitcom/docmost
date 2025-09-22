import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface DragDropPluginOptions {
  enableLogging?: boolean;
  dragHandleWidth?: number;
  showOnHover?: boolean;
}

export const dragDropPluginKey = new PluginKey('dragDropPlugin');

export function createDragDropPlugin(options: DragDropPluginOptions = {}) {
  return new Plugin({
    key: dragDropPluginKey,
    props: {
      decorations: (state) => {
        return createDragDropDecorations(state.doc, options);
      },
      handleDOMEvents: {
        dragstart: (view, event) => {
          if (options.enableLogging) {
            console.log('[DragDropPlugin] Drag start:', event.target);
          }
          return false;
        },
        dragover: (view, event) => {
          if (options.enableLogging) {
            console.log('[DragDropPlugin] Drag over:', event.target);
          }
          return false;
        },
        drop: (view, event) => {
          if (options.enableLogging) {
            console.log('[DragDropPlugin] Drop:', event.target);
          }
          return false;
        },
        dragend: (view, event) => {
          if (options.enableLogging) {
            console.log('[DragDropPlugin] Drag end:', event.target);
          }
          return false;
        },
      },
    },
  });
}

function createDragDropDecorations(doc: any, options: DragDropPluginOptions): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      const decoration = Decoration.widget(pos, () => {
        const handle = document.createElement('div');
        handle.className = 'drag-drop-handle';
        handle.setAttribute('draggable', 'true');
        handle.style.cssText = `
          position: absolute;
          left: -30px;
          top: 0px;
          width: ${options.dragHandleWidth || 20}px;
          height: 20px;
          cursor: grab;
          background: #8b5cf6;
          border: 2px solid #ffffff;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: white;
          z-index: 9999;
          user-select: none;
          opacity: ${options.showOnHover ? 0.7 : 0.9};
          transition: opacity 0.2s ease;
          pointer-events: auto;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        handle.innerHTML = '⋮⋮';
        handle.title = 'Перетащите элемент';

        if (options.showOnHover) {
          handle.addEventListener('mouseenter', () => {
            handle.style.opacity = '1';
          });

          handle.addEventListener('mouseleave', () => {
            handle.style.opacity = '0.7';
          });
        }

        handle.addEventListener('dragstart', (e) => {
          const elementId = `element-${pos}-${node.type.name}`;
          const payload = {
            type: 'element',
            elementId,
            sourceBlockId: 'plugin-block'
          };
          
          e.dataTransfer?.setData('application/json', JSON.stringify(payload));
          e.dataTransfer?.setData('text/plain', JSON.stringify(payload));
          
          if (options.enableLogging) {
            console.log('[DragDropPlugin] Drag start on handle:', {
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
        key: `drag-drop-handle-${pos}`,
      });

      decorations.push(decoration);
    }
  });

  return DecorationSet.create(doc, decorations);
}
