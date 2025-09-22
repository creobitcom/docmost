import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface WorkingDragDropOptions {
  HTMLAttributes: Record<string, any>;
  enableLogging?: boolean;
}

export const WorkingDragDrop = Extension.create<WorkingDragDropOptions>({
  name: 'workingDragDrop',

  addOptions() {
    return {
      HTMLAttributes: {},
      enableLogging: false,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('workingDragDrop'),
        props: {
          decorations: (state) => {
            return createWorkingDecorations(state.doc, this.options);
          },
          handleDOMEvents: {
            dragstart: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[WorkingDragDrop] Drag start:', event.target);
              }
              return false;
            },
            drop: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[WorkingDragDrop] Drop:', event.target);
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

function createWorkingDecorations(doc: any, options: WorkingDragDropOptions) {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
        const decoration = Decoration.widget(pos, () => {
          const handle = document.createElement('div');
          handle.className = 'working-drag-handle';
          handle.setAttribute('draggable', 'true');
          handle.style.cssText = `
            position: absolute;
            left: -30px;
            top: 0px;
            width: 20px;
            height: 20px;
            cursor: grab;
            background: #22c55e;
            border: 2px solid #ffffff;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            z-index: 9999;
            user-select: none;
            opacity: 0.9;
            transition: opacity 0.2s ease;
            pointer-events: auto;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          `;
          handle.innerHTML = '⋮⋮';
          handle.title = 'Рабочий drag handle';

          handle.addEventListener('dragstart', (e) => {
            const elementId = `element-${pos}-${node.type.name}`;
            const payload = {
              type: 'element',
              elementId,
              sourceBlockId: 'working-block'
            };
            
            e.dataTransfer?.setData('application/json', JSON.stringify(payload));
            e.dataTransfer?.setData('text/plain', JSON.stringify(payload));
            
            if (options.enableLogging) {
              console.log('[WorkingDragDrop] Drag start:', {
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
          key: `working-drag-handle-${pos}`,
        });

        decorations.push(decoration);
      }
    });

    return DecorationSet.create(doc, decorations);
}
