import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface DebugDragDropOptions {
  HTMLAttributes: Record<string, any>;
  enableLogging?: boolean;
}

export const DebugDragDrop = Extension.create<DebugDragDropOptions>({
  name: 'debugDragDrop',

  addOptions() {
    return {
      HTMLAttributes: {},
      enableLogging: true,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('debugDragDrop'),
        props: {
          handleDOMEvents: {
            dragstart: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[DebugDragDrop] Drag start:', {
                  target: event.target,
                  dataTransfer: event.dataTransfer,
                  types: event.dataTransfer?.types,
                });
              }
              return false;
            },
            dragover: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[DebugDragDrop] Drag over:', {
                  target: event.target,
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              }
              return false;
            },
            drop: (view, event) => {
              if (this.options.enableLogging) {
                console.log('[DebugDragDrop] Drop:', {
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
                console.log('[DebugDragDrop] Drag end:', {
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
