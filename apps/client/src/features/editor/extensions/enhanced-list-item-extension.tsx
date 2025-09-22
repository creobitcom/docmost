import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import React from 'react';
import { EnhancedElementHandle } from '../components/drag-handle/enhanced-element-handle';

export const EnhancedListItem = Node.create({
  name: 'listItem',

  content: 'paragraph+',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-element-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return { 'data-element-id': attributes.id };
        },
      },
      blockId: {
        default: null,
        parseHTML: (element) => element.closest('[data-block-id]')?.getAttribute('data-block-id'),
        renderHTML: (attributes) => {
          if (!attributes.blockId) {
            return {};
          }
          return { 'data-block-id': attributes.blockId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'li',
        getAttrs: (node) => (node as HTMLElement).hasAttribute('data-element-id') ? {} : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props: NodeViewProps) => {
      const { node, view, getPos, updateAttributes } = props;
      const elementId = node.attrs.id || `list-item-${Date.now()}`;
      const blockId = node.attrs.blockId || `block-${Date.now()}`;

      const handleElementDrop = (sourceId: string, targetId: string, position: 'before' | 'after') => {
        console.log('🔄 [EnhancedListItem] ===== ELEMENT DROP HANDLER =====');
        console.log('🔄 [EnhancedListItem] Source ID:', sourceId);
        console.log('🔄 [EnhancedListItem] Target ID:', targetId);
        console.log('🔄 [EnhancedListItem] Position:', position);
        console.log('🔄 [EnhancedListItem] Current element ID:', elementId);
        console.log('🔄 [EnhancedListItem] Current block ID:', blockId);

        if (sourceId === targetId) {
          console.log('🔄 [EnhancedListItem] Same element drop, ignoring');
          return;
        }

        // Здесь должна быть логика перемещения элемента в рамках блока
        // или вызов глобального обработчика для межблочного перемещения
        console.log('🔄 [EnhancedListItem] Calling onElementMove from ListItemView...');
        view.dispatch(
          view.state.tr.setMeta('elementMove', {
            sourceId,
            targetId,
            position,
            blockId, // Pass blockId for context
          })
        );
      };

      return (
        <li
          data-type="listItem"
          data-element-id={elementId}
          data-block-id={blockId}
          className="enhanced-list-item"
        >
          <EnhancedElementHandle
            elementId={elementId}
            blockId={blockId}
            view={view}
            onElementDrop={handleElementDrop}
          >
            <div className="list-item-content" contentEditable={view.editable ? "true" : "false"} />
          </EnhancedElementHandle>
        </li>
      );
    });
  },

});