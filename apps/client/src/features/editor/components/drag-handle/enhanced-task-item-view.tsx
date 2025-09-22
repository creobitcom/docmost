import React from 'react';
import { NodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { EnhancedElementHandle } from './enhanced-element-handle';

interface EnhancedTaskItemViewProps extends NodeViewProps {
  // Дополнительные пропы если нужны
}

export const EnhancedTaskItemView: React.FC<EnhancedTaskItemViewProps> = ({
  node,
  getPos,
  editor,
  HTMLAttributes,
  ...props
}) => {
  // console.log('📝 [EnhancedTaskItemView] ===== RENDERING TASK ITEM =====');
  // console.log('📝 [EnhancedTaskItemView] Node details:', {
  //   nodeType: node.type.name,
  //   pos: getPos?.(),
  //   attrs: node.attrs,
  //   content: node.content.size,
  //   checked: node.attrs?.checked,
  //   elementId: node.attrs?.elementId,
  //   blockId: node.attrs?.blockId,
  //   blockid: node.attrs?.blockid
  // });

  // 🔧 ИСПРАВЛЕНИЕ: Используем useRef для стабильного elementId
  const elementIdRef = React.useRef<string | null>(null);

  // Генерируем стабильный elementId только один раз
  if (!elementIdRef.current) {
    console.log('📝 [EnhancedTaskItemView] Generating elementId...');
    
    // Всегда генерируем новый уникальный ID для каждого элемента
    // Игнорируем атрибуты узла, так как они могут быть одинаковыми
    const blockId = (window as any).__currentBlockId || 'unknown';
    const position = getPos?.() ?? 0;
    const contentHash = node.content.size > 0 ?
      node.content.textBetween(0, node.content.size, ' ').slice(0, 20) :
      'empty';

    // Добавляем дополнительную уникальность через timestamp и случайное число
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const uniqueSuffix = `${timestamp}-${random}`;

    // Создаем уникальный ID на основе blockId, позиции и содержимого
    const stableId = `${blockId}-pos${position}-${contentHash}-${node.type.name}`;

    // Всегда используем fallback для гарантии уникальности
    elementIdRef.current = `element-${uniqueSuffix}`;

    console.log('📝 [EnhancedTaskItemView] Generated elementId:', {
      elementId: elementIdRef.current,
      blockId,
      position,
      contentHash,
      nodeType: node.type.name,
      stableId
    });
  }

  const elementId = elementIdRef.current;

  // Получаем blockId из контекста редактора
  const blockId = React.useMemo(() => {
    // 🔧 ИСПРАВЛЕНИЕ: Приоритет - DOM lookup для получения реального blockId
    // Сначала пытаемся найти blockId в DOM от редактора
    const editorElement = editor?.view?.dom?.closest('[data-block-id]');
    if (editorElement) {
      const domBlockId = editorElement.getAttribute('data-block-id');
      // console.log('📝 [EnhancedTaskItemView] Using blockId from DOM (editor):', domBlockId);
      return domBlockId;
    }
    
    // Затем из глобального состояния
    if ((window as any).__currentBlockId) {
      // console.log('📝 [EnhancedTaskItemView] Using blockId from window.__currentBlockId:', (window as any).__currentBlockId);
      return (window as any).__currentBlockId;
    }
    
    // Fallback - пытаемся получить из атрибутов узла (но это может быть неправильно)
    if (node.attrs?.blockId) {
      // console.log('📝 [EnhancedTaskItemView] Using blockId from node.attrs (fallback):', node.attrs.blockId);
      return node.attrs.blockId;
    }
    
    // console.warn('📝 [EnhancedTaskItemView] No blockId found, using unknown');
    return 'unknown';
  }, [node.attrs?.blockId, editor]);

  // 🔧 ИСПРАВЛЕНИЕ: Устанавливаем elementId и blockId в атрибуты узла если их нет
  React.useEffect(() => {
    const needsUpdate = (!node.attrs?.elementId && elementId) || (!node.attrs?.blockId && blockId);
    
    if (needsUpdate) {
      // console.log('📝 [EnhancedTaskItemView] Setting elementId and blockId in node attrs:', { elementId, blockId });
      // console.log('📝 [EnhancedTaskItemView] Current node attrs:', node.attrs);
      const pos = getPos?.();
      if (pos !== undefined) {
        // console.log('📝 [EnhancedTaskItemView] Updating node markup at position:', pos);
        editor.chain()
          .focus()
          .command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              elementId: elementId || node.attrs?.elementId,
              blockId: blockId || node.attrs?.blockId
            });
            return true;
          })
          .run();
        // console.log('📝 [EnhancedTaskItemView] Node markup updated successfully');
        
        // Проверяем, что атрибуты действительно установлены
        setTimeout(() => {
          const updatedNode = editor.state.doc.nodeAt(pos);
          // console.log('📝 [EnhancedTaskItemView] Node after update:', {
          //   pos,
          //   elementId: updatedNode?.attrs?.elementId,
          //   blockId: updatedNode?.attrs?.blockId,
          //   allAttrs: updatedNode?.attrs
          // });
        }, 100);
      } else {
        // console.warn('📝 [EnhancedTaskItemView] Position is undefined, cannot update node markup');
      }
    }
  }, [elementId, blockId, node.attrs?.elementId, node.attrs?.blockId, getPos, editor]);

  // console.log('📝 [EnhancedTaskItemView] Element identifiers:', {
  //   elementId,
  //   blockId,
  //   globalBlockId: (window as any).__currentBlockId,
  //   checked: node.attrs?.checked
  // });

  const handleDragStart = (elementId: string) => {
    // console.log('📝 [EnhancedTaskItemView] Task element drag start:', elementId);
    // console.log('📝 [EnhancedTaskItemView] Node attrs at drag start:', node.attrs);
    // console.log('📝 [EnhancedTaskItemView] Element ID from ref:', elementIdRef.current);
    // console.log('📝 [EnhancedTaskItemView] Element ID from node attrs:', node.attrs?.elementId);
    
    // Проверяем, что elementId установлен в атрибутах узла
    if (!node.attrs?.elementId && elementId) {
      // console.warn('📝 [EnhancedTaskItemView] WARNING: elementId not in node attrs, forcing update...');
      const pos = getPos?.();
      if (pos !== undefined) {
        editor.chain()
          .focus()
          .command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              elementId: elementId
            });
            return true;
          })
          .run();
        // console.log('📝 [EnhancedTaskItemView] Forced elementId update completed');
      }
    }
  };

  const handleDragEnd = (elementId: string) => {
    // console.log('📝 [EnhancedTaskItemView] Task element drag end:', elementId);
  };

  const handleElementDrop = (sourceId: string, targetId: string, position: 'before' | 'after') => {
    console.log('🔄 [EnhancedTaskItemView] ===== ELEMENT DROP HANDLER =====');
    console.log('🔄 [EnhancedTaskItemView] Source ID:', sourceId);
    console.log('🔄 [EnhancedTaskItemView] Target ID:', targetId);
    console.log('🔄 [EnhancedTaskItemView] Position:', position);
    console.log('🔄 [EnhancedTaskItemView] Current element ID:', elementId);
    console.log('🔄 [EnhancedTaskItemView] Current block ID:', blockId);

    try {
      // Проверяем, что это внутриблочное перемещение
      if (sourceId === targetId) {
        console.log('🔄 [EnhancedTaskItemView] Same element drop, ignoring');
        return;
      }

      // 🔧 ИСПРАВЛЕНИЕ: Находим позиции исходного и целевого элементов
      let sourcePos: number | null = null;
      let targetPos: number | null = null;

      editor.state.doc.descendants((node, pos) => {
        if (node.attrs?.elementId === sourceId) {
          sourcePos = pos;
          console.log('🔄 [EnhancedTaskItemView] Found source element at position:', pos);
        }
        if (node.attrs?.elementId === targetId) {
          targetPos = pos;
          console.log('🔄 [EnhancedTaskItemView] Found target element at position:', pos);
        }
      });

      if (sourcePos === null) {
        console.warn('❌ [EnhancedTaskItemView] Source element not found in document:', sourceId);
        return;
      }

      if (targetPos === null) {
        console.warn('❌ [EnhancedTaskItemView] Target element not found in document:', targetId);
        return;
      }

      console.log('🔄 [EnhancedTaskItemView] Source position:', sourcePos);
      console.log('🔄 [EnhancedTaskItemView] Target position:', targetPos);

      // Проверяем, что элементы действительно разные
      if (sourcePos === targetPos) {
        console.log('🔄 [EnhancedTaskItemView] Source and target are the same position, ignoring');
        return;
      }

      // 🔧 ИСПРАВЛЕНИЕ: Улучшенная логика перемещения элементов в списке
      const sourceNode = editor.state.doc.nodeAt(sourcePos);
      if (!sourceNode) {
        console.warn('❌ [EnhancedTaskItemView] Source node not found at position:', sourcePos);
        return;
      }

      const targetNode = editor.state.doc.nodeAt(targetPos);
      if (!targetNode) {
        console.warn('❌ [EnhancedTaskItemView] Target node not found at position:', targetPos);
        return;
      }

      console.log('🔄 [EnhancedTaskItemView] Source node size:', sourceNode.nodeSize);
      console.log('🔄 [EnhancedTaskItemView] Target node size:', targetNode.nodeSize);

      // Определяем позицию вставки
      let insertPos: number;
      if (position === 'before') {
        insertPos = targetPos;
      } else {
        insertPos = targetPos + targetNode.nodeSize;
      }
      
      console.log('🔄 [EnhancedTaskItemView] Insert position (before adjustment):', insertPos);

      // Выполняем перемещение с правильной логикой
      const tr = editor.state.tr;
      
      if (sourcePos < insertPos) {
        // Исходный элемент находится до позиции вставки
        // Сначала вставляем в новую позицию, потом удаляем старую
        tr.insert(insertPos, sourceNode);
        tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
        console.log('🔄 [EnhancedTaskItemView] Move forward: insert then delete');
      } else {
        // Исходный элемент находится после позиции вставки
        // Сначала удаляем старую позицию, потом вставляем в новую
        tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
        tr.insert(insertPos, sourceNode);
        console.log('🔄 [EnhancedTaskItemView] Move backward: delete then insert');
      }

      // Применяем транзакцию
      editor.view.dispatch(tr);
      console.log('✅ [EnhancedTaskItemView] Element move transaction applied');
      
      console.log('✅ [EnhancedTaskItemView] ===== ELEMENT DROP COMPLETED =====');
    } catch (error) {
      console.error('❌ [EnhancedTaskItemView] Error in handleElementDrop:', error);
      console.error('❌ [EnhancedTaskItemView] Error stack:', error.stack);
    }
  };

  // Получаем состояние checked
  const isChecked = node.attrs?.checked || false;

  return (
    <NodeViewWrapper
      as="li"
      {...HTMLAttributes}
      data-element-id={elementId}
      data-block-id={blockId}
      data-checked={isChecked}
      style={{ position: 'relative', listStyle: 'none' }}
    >
      <EnhancedElementHandle
        elementId={elementId}
        blockId={blockId}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onElementDrop={handleElementDrop}
      >
        {/* 🔧 ИСПРАВЛЕНИЕ: Общий flex-контейнер для checkbox и содержимого */}
        <div className="element-content" style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', width: '100%' }}>
          {/* Checkbox для TaskItem */}
          <label contentEditable={false} style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', flexShrink: 0, paddingTop: '2px' }}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                // Обновляем состояние узла через Tiptap
                const pos = getPos?.();
                if (pos !== undefined) {
                  editor.chain()
                    .focus()
                    .command(({ tr }) => {
                      tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        checked: e.target.checked
                      });
                      return true;
                    })
                    .run();
                }
              }}
              style={{
                cursor: 'pointer'
              }}
            />
            <span style={{ cursor: 'pointer', userSelect: 'none' }} />
          </label>

          {/* Содержимое taskItem */}
          <div className="task-item-content" style={{ flex: 1, minWidth: 0 }}>
            {/* Обертываем содержимое в div для правильной структуры */}
            <div>
              <NodeViewContent />
            </div>
          </div>
        </div>
      </EnhancedElementHandle>
    </NodeViewWrapper>
  );
};
