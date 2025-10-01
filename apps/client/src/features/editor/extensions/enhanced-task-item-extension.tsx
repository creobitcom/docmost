import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import React from 'react';
import { EnhancedElementHandle } from '../components/drag-handle/enhanced-element-handle';

export const EnhancedTaskItem = Node.create({
  name: 'taskItem',

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
      checked: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-checked') === 'true',
        renderHTML: (attributes) => {
          if (attributes.checked) {
            return { 'data-checked': 'true' };
          }
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'li[data-type="taskItem"]',
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
      const elementId = node.attrs.id || `task-item-${Date.now()}`;
      const blockId = node.attrs.blockId || `block-${Date.now()}`;
      const isChecked = node.attrs.checked;

      const handleCheckboxChange = () => {
        updateAttributes({ checked: !isChecked });
      };

      const handleElementDrop = (sourceId: string, targetId: string, position: 'before' | 'after') => {
        console.log('🔄 [EnhancedTaskItem] ===== ELEMENT DROP HANDLER =====');
        console.log('🔄 [EnhancedTaskItem] Source ID:', sourceId);
        console.log('🔄 [EnhancedTaskItem] Target ID:', targetId);
        console.log('🔄 [EnhancedTaskItem] Position:', position);
        console.log('🔄 [EnhancedTaskItem] Current element ID:', elementId);
        console.log('🔄 [EnhancedTaskItem] Current block ID:', blockId);

        if (sourceId === targetId) {
          console.log('🔄 [EnhancedTaskItem] Same element drop, ignoring');
          return;
        }

        // Здесь должна быть логика перемещения элемента в рамках блока
        // или вызов глобального обработчика для межблочного перемещения
        console.log('🔄 [EnhancedTaskItem] Calling onElementMove from TaskItemView...');
        view.dispatch(
          view.state.tr.setMeta('elementMove', {
            sourceId,
            targetId,
            position,
            blockId, // Pass blockId for context
          })
        );
      };

      // Сохраняем JSON контент элемента в data-атрибуте для кроссблочного перемещения
      const nodeJSON = node.toJSON();
      const contentJSON = JSON.stringify(nodeJSON);

      return (
        <li
          data-type="taskItem"
          data-checked={isChecked}
          data-element-id={elementId}
          data-block-id={blockId}
          data-content={contentJSON}
          className="enhanced-task-item"
        >
          <EnhancedElementHandle
            elementId={elementId}
            blockId={blockId}
            view={view}
            onElementDrop={handleElementDrop}
          >
            <label>
              <input type="checkbox" checked={isChecked} onChange={handleCheckboxChange} />
              <span className="task-item-content" contentEditable={view.editable ? "true" : "false"} />
            </label>
          </EnhancedElementHandle>
        </li>
      );
    });
  },

});