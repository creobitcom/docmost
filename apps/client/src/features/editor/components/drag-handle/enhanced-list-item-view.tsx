import React from 'react';
import { NodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { EnhancedElementHandle } from './enhanced-element-handle';

interface EnhancedListItemViewProps extends NodeViewProps {
  // Дополнительные пропы если нужны
}

export const EnhancedListItemView: React.FC<EnhancedListItemViewProps> = ({
  node,
  getPos,
  editor,
  HTMLAttributes,
  ...props
}) => {
  // console.log('📝 [EnhancedListItemView] ===== RENDERING LIST ITEM =====');
  // console.log('📝 [EnhancedListItemView] Node details:', {
  //   nodeType: node.type.name,
  //   pos: getPos?.(),
  //   attrs: node.attrs,
  //   content: node.content.size,
  //   elementId: node.attrs?.elementId,
  //   blockId: node.attrs?.blockId,
  //   blockid: node.attrs?.blockid
  // });

  // 🔧 ИСПРАВЛЕНИЕ: Используем useRef для стабильного elementId
  const elementIdRef = React.useRef<string | null>(null);
  
  // Генерируем стабильный elementId только один раз
  if (!elementIdRef.current) {
    console.log('📝 [EnhancedListItemView] Generating elementId...');
    
    // Всегда генерируем новый уникальный ID для каждого элемента
    // Игнорируем атрибуты узла, так как они могут быть одинаковыми
    const blockId = node.attrs?.blockId || (window as any).__currentBlockId || 'unknown';
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
      
    console.log('📝 [EnhancedListItemView] Generated elementId:', {
      elementId: elementIdRef.current,
      blockId,
      position,
      contentHash,
      nodeType: node.type.name,
      stableId
    });
  }

  const elementId = elementIdRef.current;
  
  // 🔧 ИСПРАВЛЕНИЕ: Устанавливаем elementId в атрибуты узла если его нет
  React.useEffect(() => {
    if (!node.attrs?.elementId && elementId) {
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
      }
    }
  }, [elementId, node.attrs?.elementId, getPos, editor]);
  
  // Получаем blockId из контекста редактора
  const blockId = React.useMemo(() => {
    // 🔧 ИСПРАВЛЕНИЕ: Приоритет - DOM lookup для получения реального blockId
    // Сначала пытаемся найти blockId в DOM от редактора
    const editorElement = editor?.view?.dom?.closest('[data-block-id]');
    if (editorElement) {
      const domBlockId = editorElement.getAttribute('data-block-id');
      // console.log('📝 [EnhancedListItemView] Using blockId from DOM (editor):', domBlockId);
      return domBlockId;
    }
    
    // Затем из глобального состояния
    if ((window as any).__currentBlockId) {
      // console.log('📝 [EnhancedListItemView] Using blockId from window.__currentBlockId:', (window as any).__currentBlockId);
      return (window as any).__currentBlockId;
    }
    
    // Fallback - пытаемся получить из атрибутов узла (но это может быть неправильно)
    if (node.attrs?.blockId) {
      // console.log('📝 [EnhancedListItemView] Using blockId from node.attrs (fallback):', node.attrs.blockId);
      return node.attrs.blockId;
    }
    
    // console.warn('📝 [EnhancedListItemView] No blockId found, using unknown');
    return 'unknown';
  }, [node.attrs?.blockId, editor]);

  // console.log('[EnhancedListItemView] Element identifiers:', {
  //   elementId,
  //   blockId,
  //   globalBlockId: (window as any).__currentBlockId
  // });

  const handleDragStart = (elementId: string) => {
    // console.log('[EnhancedListItemView] Element drag start:', elementId);
  };

  const handleDragEnd = (elementId: string) => {
    // console.log('[EnhancedListItemView] Element drag end:', elementId);
  };

  const handleElementDrop = (sourceId: string, targetId: string, position: 'before' | 'after') => {
    console.log('🔄 [EnhancedListItemView] ===== ELEMENT DROP HANDLER =====');
    console.log('🔄 [EnhancedListItemView] Source ID:', sourceId);
    console.log('🔄 [EnhancedListItemView] Target ID:', targetId);
    console.log('🔄 [EnhancedListItemView] Position:', position);
    console.log('🔄 [EnhancedListItemView] Current element ID:', elementId);
    console.log('🔄 [EnhancedListItemView] Current block ID:', blockId);
    
    // Проверяем, что это не тот же элемент
    if (sourceId === targetId) {
      console.log('🔄 [EnhancedListItemView] Same element drop, ignoring');
      return;
    }

    try {
      // Находим позиции элементов в документе
      const sourcePos = findElementPosition(sourceId);
      const targetPos = findElementPosition(targetId);

      if (sourcePos === -1 || targetPos === -1) {
        console.warn('❌ [EnhancedListItemView] Could not find element positions');
        return;
      }

      console.log('🔄 [EnhancedListItemView] Source position:', sourcePos);
      console.log('🔄 [EnhancedListItemView] Target position:', targetPos);

      // Проверяем, что элементы действительно разные
      if (sourcePos === targetPos) {
        console.log('🔄 [EnhancedListItemView] Source and target are the same position, ignoring');
        return;
      }

      // 🔧 ИСПРАВЛЕНИЕ: Улучшенная логика перемещения элементов в списке
      const sourceNode = editor.state.doc.nodeAt(sourcePos);
      if (!sourceNode) {
        console.warn('❌ [EnhancedListItemView] Source node not found at position:', sourcePos);
        return;
      }

      const targetNode = editor.state.doc.nodeAt(targetPos);
      if (!targetNode) {
        console.warn('❌ [EnhancedListItemView] Target node not found at position:', targetPos);
        return;
      }

      console.log('🔄 [EnhancedListItemView] Source node size:', sourceNode.nodeSize);
      console.log('🔄 [EnhancedListItemView] Target node size:', targetNode.nodeSize);

      // Определяем позицию вставки
      let insertPos: number;
      if (position === 'before') {
        insertPos = targetPos;
      } else {
        insertPos = targetPos + targetNode.nodeSize;
      }
      
      console.log('🔄 [EnhancedListItemView] Insert position (before adjustment):', insertPos);

      // Выполняем перемещение с правильной логикой
      const tr = editor.state.tr;
      
      if (sourcePos < insertPos) {
        // Исходный элемент находится до позиции вставки
        // Сначала вставляем в новую позицию, потом удаляем старую
        tr.insert(insertPos, sourceNode);
        tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
        console.log('🔄 [EnhancedListItemView] Move forward: insert then delete');
      } else {
        // Исходный элемент находится после позиции вставки
        // Сначала удаляем старую позицию, потом вставляем в новую
        tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
        tr.insert(insertPos, sourceNode);
        console.log('🔄 [EnhancedListItemView] Move backward: delete then insert');
      }

      // Применяем транзакцию
      editor.view.dispatch(tr);
      console.log('✅ [EnhancedListItemView] Element move transaction applied');
      
      console.log('✅ [EnhancedListItemView] ===== ELEMENT DROP COMPLETED =====');
    } catch (error) {
      console.error('❌ [EnhancedListItemView] Error in handleElementDrop:', error);
      console.error('❌ [EnhancedListItemView] Error stack:', error.stack);
    }
  };

  // Функция для поиска позиции элемента по elementId
  const findElementPosition = (elementId: string): number => {
    console.log('🔍 [EnhancedListItemView] Finding position for element:', elementId);
    
    let position = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs?.elementId === elementId) {
        position = pos;
        console.log('✅ [EnhancedListItemView] Found element at position:', pos);
        return false; // Останавливаем поиск
      }
    });
    
    if (position === -1) {
      console.warn('⚠️ [EnhancedListItemView] Element not found:', elementId);
    }
    
    return position;
  };

  // Определяем тип родительского списка для правильного отображения маркеров
  const getListType = () => {
    // Сначала пытаемся найти родительский список через DOM
    const element = editor?.view?.dom?.querySelector(`[data-element-id="${elementId}"]`);
    if (element) {
      const parentList = element.closest('ul[data-type="taskList"], ul.bullet-list, ol.ordered-list');
      if (parentList) {
        if (parentList.hasAttribute('data-type') && parentList.getAttribute('data-type') === 'taskList') {
          return 'task';
        } else if (parentList.classList.contains('bullet-list')) {
          return 'bullet';
        } else if (parentList.classList.contains('ordered-list')) {
          return 'ordered';
        }
      }
    }
    
    // Fallback: ищем в общем DOM редактора
    const parentList = editor?.view?.dom?.closest('ul[data-type="taskList"], ul.bullet-list, ol.ordered-list');
    if (parentList) {
      if (parentList.hasAttribute('data-type') && parentList.getAttribute('data-type') === 'taskList') {
        return 'task';
      } else if (parentList.classList.contains('bullet-list')) {
        return 'bullet';
      } else if (parentList.classList.contains('ordered-list')) {
        return 'ordered';
      }
    }
    
    return 'unknown';
  };

  // Определяем тип узла для дополнительной проверки
  const getNodeType = () => {
    // Пытаемся найти узел по elementId в DOM
    const element = editor?.view?.dom?.querySelector(`[data-element-id="${elementId}"]`);
    if (element) {
      // Проверяем, является ли это taskItem или listItem
      if (element.closest('li[data-checked]')) {
        return 'taskItem';
      } else if (element.closest('li:not([data-checked])')) {
        return 'listItem';
      }
      
      // Дополнительная проверка по классам
      if (element.classList.contains('enhanced-list-item-task')) {
        return 'taskItem';
      } else if (element.classList.contains('enhanced-list-item-bullet') || element.classList.contains('enhanced-list-item-ordered')) {
        return 'listItem';
      }
    }
    
    // Fallback: находим текущий узел в Tiptap state
    const pos = editor?.view?.state?.selection?.from;
    if (pos === undefined) return 'unknown';
    
    const node = editor?.view?.state?.doc?.nodeAt(pos);
    if (!node) return 'unknown';
    
    return node.type.name;
  };

  const listType = getListType();
  const nodeType = getNodeType();
  const element = editor?.view?.dom?.querySelector(`[data-element-id="${elementId}"]`);
  const parentList = element?.closest('ul[data-type="taskList"], ul.bullet-list, ol.ordered-list');
  
  // console.log('[EnhancedListItemView] Element analysis:', {
  //   elementId,
  //   listType,
  //   nodeType,
  //   hasElement: !!element,
  //   elementTag: element?.tagName,
  //   elementClasses: element?.className,
  //   hasDataChecked: element?.closest('li[data-checked]') !== null,
  //   parentList: parentList?.tagName,
  //   parentListClasses: parentList?.className,
  //   parentListData: parentList?.getAttribute('data-type')
  // });

  // Определяем классы в зависимости от типа списка и узла
  const getClassName = () => {
    // Приоритет отдаем типу узла, так как он более точный
    if (nodeType === 'taskItem') {
      return 'enhanced-list-item-task';
    } else if (nodeType === 'listItem') {
      // Для listItem определяем тип по контейнеру
      if (listType === 'bullet') {
        return 'enhanced-list-item-bullet';
      } else if (listType === 'ordered') {
        return 'enhanced-list-item-ordered';
      }
    }
    
    // Fallback на тип списка
    if (listType === 'task') {
      return 'enhanced-list-item-task';
    } else if (listType === 'bullet') {
      return 'enhanced-list-item-bullet';
    } else if (listType === 'ordered') {
      return 'enhanced-list-item-ordered';
    }
    
    return 'enhanced-list-item-normal';
  };

  return (
    <NodeViewWrapper
      as="li"
      {...HTMLAttributes}
      data-element-id={elementId}
      data-block-id={blockId}
      className={getClassName()}
      style={{ position: 'relative' }}
    >
      <EnhancedElementHandle
        elementId={elementId}
        blockId={blockId}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onElementDrop={handleElementDrop}
      >
        {/* Унифицированная структура для всех типов списков */}
        <div className="list-item-content" style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', width: '100%' }}>
          {nodeType === 'taskItem' ? (
            /* Для taskItem - чекбокс уже создается в NodeViewContent */
            <div>
              <NodeViewContent />
            </div>
          ) : (
            /* Для listItem - создаем маркер как отдельный элемент */
            <>
              <div className="list-marker" style={{ 
                flex: '0 0 auto', 
                width: '1em', 
                height: '1em', 
                marginRight: '0.5rem', 
                marginTop: '0.125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                lineHeight: '1',
                userSelect: 'none',
                color: 'var(--mantine-color-dimmed)',
                fontWeight: '500'
              }}>
                {/* Маркер будет добавлен через CSS в зависимости от класса элемента */}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <NodeViewContent />
              </div>
            </>
          )}
        </div>
      </EnhancedElementHandle>
    </NodeViewWrapper>
  );
};
