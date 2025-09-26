import React, { useState, useRef } from 'react';
import { IconGripVertical } from '@tabler/icons-react';
import { dndCoordinator } from '../../dnd/DndCoordinator';
import { handleUnifiedDragStart, handleUnifiedDragOver, handleUnifiedDrop, cleanupDragState, clearDragOverCache } from '../../utils/unified-drag-handlers';
import { UnifiedDragData } from '../../types/drag-types';

interface EnhancedElementHandleProps {
  elementId: string;
  blockId: string;
  children: React.ReactNode;
  view?: any; // EditorView
  onDragStart?: (elementId: string) => void;
  onDragEnd?: (elementId: string) => void;
  onElementDrop?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
}

export const EnhancedElementHandle: React.FC<EnhancedElementHandleProps> = ({
  elementId,
  blockId,
  children,
  view,
  onDragStart,
  onDragEnd,
  onElementDrop
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleDragStart = async (event: React.DragEvent) => {
    console.log('🎯 [EnhancedElementHandle] ===== DRAG START =====');
    console.log('🎯 [EnhancedElementHandle] Element ID:', elementId);
    console.log('🎯 [EnhancedElementHandle] Block ID:', blockId);
    console.log('🎯 [EnhancedElementHandle] Event target:', event.target);
    console.log('🎯 [EnhancedElementHandle] Event currentTarget:', event.currentTarget);
    console.log('🎯 [EnhancedElementHandle] Event type:', event.type);
    console.log('🎯 [EnhancedElementHandle] Event bubbles:', event.bubbles);
    console.log('🎯 [EnhancedElementHandle] Event cancelable:', event.cancelable);
    console.log('🎯 [EnhancedElementHandle] DataTransfer types:', event.dataTransfer?.types);
    console.log('🎯 [EnhancedElementHandle] DataTransfer effectAllowed:', event.dataTransfer?.effectAllowed);

    try {
      // 🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Только stopPropagation, НЕ preventDefault!
      // preventDefault() в dragstart блокирует весь drag-and-drop
      event.stopPropagation();
      console.log('🎯 [EnhancedElementHandle] Event propagation stopped');

      setIsDragging(true);
      console.log('🎯 [EnhancedElementHandle] Dragging state set to true');

      onDragStart?.(elementId);
      console.log('🎯 [EnhancedElementHandle] onDragStart callback called');

      // 🎯 ИСПОЛЬЗУЕМ УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ
      console.log('🎯 [EnhancedElementHandle] Calling handleUnifiedDragStart...');
      console.log('🎯 [EnhancedElementHandle] Event details:', {
        type: event.type,
        target: event.target,
        nativeEvent: event.nativeEvent,
        dataTransfer: event.dataTransfer
      });

      const dragData = await handleUnifiedDragStart(event.nativeEvent);
      console.log('🎯 [EnhancedElementHandle] handleUnifiedDragStart completed, result:', dragData);

      if (dragData) {
        console.log('✅ [EnhancedElementHandle] Element drag data set successfully:', dragData);
        console.log('✅ [EnhancedElementHandle] Drag data type:', dragData.type);
        console.log('✅ [EnhancedElementHandle] Drag data version:', dragData.version);
        console.log('✅ [EnhancedElementHandle] Drag data timestamp:', dragData.timestamp);
      } else {
        console.error('❌ [EnhancedElementHandle] Failed to set drag data - handleUnifiedDragStart returned null');
      }
    } catch (error) {
      console.error('❌ [EnhancedElementHandle] Error in handleDragStart:', error);
      console.error('❌ [EnhancedElementHandle] Error stack:', error.stack);
    }

    console.log('🎯 [EnhancedElementHandle] ===== DRAG START END =====');
  };

  const handleDragEnd = (event: React.DragEvent) => {
    console.log('🏁 [EnhancedElementHandle] ===== DRAG END =====');
    console.log('🏁 [EnhancedElementHandle] Element ID:', elementId);
    console.log('🏁 [EnhancedElementHandle] Block ID:', blockId);
    console.log('🏁 [EnhancedElementHandle] Event type:', event.type);
    console.log('🏁 [EnhancedElementHandle] Event target:', event.target);
    console.log('🏁 [EnhancedElementHandle] DataTransfer dropEffect:', event.dataTransfer?.dropEffect);
    console.log('🏁 [EnhancedElementHandle] DataTransfer effectAllowed:', event.dataTransfer?.effectAllowed);

    try {
      setIsDragging(false);
      console.log('🏁 [EnhancedElementHandle] Dragging state set to false');

      onDragEnd?.(elementId);
      console.log('🏁 [EnhancedElementHandle] onDragEnd callback called');

      // Очистка drag состояния
      console.log('🏁 [EnhancedElementHandle] Cleaning up drag state...');
      cleanupDragState();
      clearDragOverCache(); // 🔧 ИСПРАВЛЕНИЕ: Очищаем кэш dragover
      console.log('🏁 [EnhancedElementHandle] Drag state cleaned up');
    } catch (error) {
      console.error('❌ [EnhancedElementHandle] Error in handleDragEnd:', error);
      console.error('❌ [EnhancedElementHandle] Error stack:', error.stack);
    }

    console.log('🏁 [EnhancedElementHandle] ===== DRAG END END =====');
  };

  const handleDragOver = (event: React.DragEvent) => {
    console.log('🔄 [EnhancedElementHandle] ===== DRAG OVER =====');
    console.log('🔄 [EnhancedElementHandle] Element ID:', elementId);
    console.log('🔄 [EnhancedElementHandle] Block ID:', blockId);
    console.log('🔄 [EnhancedElementHandle] Event type:', event.type);
    console.log('🔄 [EnhancedElementHandle] Event clientY:', event.clientY);
    console.log('🔄 [EnhancedElementHandle] Event target:', event.target);

    try {
      // 🎯 ИСПОЛЬЗУЕМ УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ
      console.log('🔄 [EnhancedElementHandle] Calling handleUnifiedDragOver...');
      const handled = handleUnifiedDragOver(event.nativeEvent);
      console.log('🔄 [EnhancedElementHandle] handleUnifiedDragOver result:', handled);

      if (handled) {
        // Определяем позицию drop для визуальных индикаторов
        if (elementRef.current) {
          const rect = elementRef.current.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const position = event.clientY < midY ? 'before' : 'after';
          console.log('🔍 [EnhancedElementHandle] Drop position calculated:', {
            elementId,
            clientY: event.clientY,
            top: rect.top,
            height: rect.height,
            midY,
            isBefore: event.clientY < midY,
            position,
            rect: { top: rect.top, height: rect.height }
          });
          setDragOverPosition(position);
        }
      }
    } catch (error) {
      console.error('❌ [EnhancedElementHandle] Error in handleDragOver:', error);
      console.error('❌ [EnhancedElementHandle] Error stack:', error.stack);
    }

    console.log('🔄 [EnhancedElementHandle] ===== DRAG OVER END =====');
  };

  const handleDragLeave = () => {
    console.log('🚪 [EnhancedElementHandle] ===== DRAG LEAVE =====');
    console.log('🚪 [EnhancedElementHandle] Element ID:', elementId);
    console.log('🚪 [EnhancedElementHandle] Block ID:', blockId);

    try {
      setDragOverPosition(null);
      console.log('🚪 [EnhancedElementHandle] Drag over position cleared');
    } catch (error) {
      console.error('❌ [EnhancedElementHandle] Error in handleDragLeave:', error);
      console.error('❌ [EnhancedElementHandle] Error stack:', error.stack);
    }

    console.log('🚪 [EnhancedElementHandle] ===== DRAG LEAVE END =====');
  };

  const handleDrop = (event: React.DragEvent) => {
    console.log('🎯 [EnhancedElementHandle] ===== DROP =====');
    console.log('🎯 [EnhancedElementHandle] Element ID:', elementId);
    console.log('🎯 [EnhancedElementHandle] Block ID:', blockId);
    console.log('🎯 [EnhancedElementHandle] Event type:', event.type);
    console.log('🎯 [EnhancedElementHandle] Event target:', event.target);
    console.log('🎯 [EnhancedElementHandle] DataTransfer dropEffect:', event.dataTransfer?.dropEffect);
    console.log('🎯 [EnhancedElementHandle] DataTransfer types:', event.dataTransfer?.types);

    try {
      setDragOverPosition(null);
      console.log('🎯 [EnhancedElementHandle] Drag over position cleared');

      // 🎯 ИСПОЛЬЗУЕМ УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ
      console.log('🎯 [EnhancedElementHandle] Calling handleUnifiedDrop...');
      const handled = handleUnifiedDrop(
        event.nativeEvent,
        (sourceBlockId, sourceElementId, targetBlockId, beforeElementId) => {
          console.log('✅ [EnhancedElementHandle] Element drop handled:', {
            sourceBlockId,
            sourceElementId,
            targetBlockId,
            beforeElementId,
            isCrossBlock: sourceBlockId !== targetBlockId
          });

          // Если это cross-block drop, диспатчим событие
          if (sourceBlockId !== targetBlockId) {
            console.log('🔄 [EnhancedElementHandle] ===== CROSS-BLOCK DROP DETECTED =====');
            console.log('🔄 [EnhancedElementHandle] Source block ID:', sourceBlockId);
            console.log('🔄 [EnhancedElementHandle] Target block ID:', targetBlockId);
            console.log('🔄 [EnhancedElementHandle] Source element ID:', sourceElementId);
            console.log('🔄 [EnhancedElementHandle] Target element ID:', elementId);
            console.log('🔄 [EnhancedElementHandle] Before element ID:', beforeElementId);
            console.log('🔄 [EnhancedElementHandle] Target position:', beforeElementId ? 'before' : 'after');

            // 🔧 ИСПРАВЛЕНИЕ: Правильно определяем позицию на основе dragOverPosition
            let targetPosition: 'before' | 'after' = 'after';
            let finalBeforeElementId = beforeElementId;

            if (dragOverPosition === 'before') {
              targetPosition = 'before';
              finalBeforeElementId = elementId; // Вставляем перед текущим элементом
            } else if (dragOverPosition === 'after') {
              targetPosition = 'after';
              finalBeforeElementId = undefined; // Вставляем в начало списка
            } else if (beforeElementId) {
              // Fallback: используем beforeElementId если dragOverPosition не определен
              targetPosition = 'before';
              finalBeforeElementId = beforeElementId;
            }

            const eventDetail = {
              sourceBlockId,
              targetBlockId,
              elementData: {
                id: sourceElementId,
                type: 'listItem',
                content: null,
                position: 0,
                parentBlockId: sourceBlockId,
              },
              targetPosition,
              beforeElementId: finalBeforeElementId,
              elementId: sourceElementId,
            };

            console.log('🔍 [EnhancedElementHandle] Final dropDetails before dispatch:', {
              sourceBlockId,
              targetBlockId,
              sourceElementId,
              targetElementId: elementId,
              beforeElementId: finalBeforeElementId,
              targetPosition,
              currentDragOverPosition: dragOverPosition,
              originalBeforeElementId: beforeElementId
            });
            console.log('🔄 [EnhancedElementHandle] Creating cross-block event with detail:', eventDetail);
            const crossBlockEvent = new CustomEvent('cross-block-element-move', {
              detail: eventDetail
            });

            console.log('🔄 [EnhancedElementHandle] Event created:', {
              type: crossBlockEvent.type,
              detail: crossBlockEvent.detail,
              bubbles: crossBlockEvent.bubbles,
              cancelable: crossBlockEvent.cancelable
            });

            console.log('🔄 [EnhancedElementHandle] Dispatching cross-block event...');
            document.dispatchEvent(crossBlockEvent);
            console.log('✅ [EnhancedElementHandle] Cross-block element move event dispatched successfully');
            console.log('✅ [EnhancedElementHandle] ===== CROSS-BLOCK DROP COMPLETED =====');
          } else {
            // Внутриблоковое перемещение
            console.log('🔄 [EnhancedElementHandle] Intra-block drop detected, calling onElementDrop...');

            // 🔧 ИСПРАВЛЕНИЕ: Используем реальную позицию из dragOverPosition
            const actualPosition = dragOverPosition || (beforeElementId ? 'before' : 'after');

            // 🔧 ИСПРАВЛЕНИЕ: Правильно определяем targetElementId для внутриблокового перемещения
            let targetElementId: string;
            if (beforeElementId) {
              // Если есть beforeElementId, используем его как целевой элемент
              targetElementId = beforeElementId;
            } else if (dragOverPosition === 'before') {
              // Если позиция 'before' и нет beforeElementId, вставляем перед текущим элементом
              targetElementId = elementId;
            } else {
              // Если позиция 'after' и нет beforeElementId, вставляем в начало списка
              // Находим первый элемент в списке
              const currentElement = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement;
              const parentList = currentElement?.closest('ul, ol');
              if (parentList) {
                const firstElement = parentList.querySelector('[data-element-id]') as HTMLElement;
                targetElementId = firstElement?.getAttribute('data-element-id') || elementId;
              } else {
                targetElementId = elementId;
              }
            }

            console.log('🔄 [EnhancedElementHandle] Drop parameters:', {
              sourceElementId,
              targetElementId,
              actualPosition,
              dragOverPosition,
              beforeElementId,
              elementId
            });

            onElementDrop?.(sourceElementId, targetElementId, actualPosition);
            console.log('✅ [EnhancedElementHandle] Intra-block drop handled');
          }
        }
      );

      console.log('🎯 [EnhancedElementHandle] handleUnifiedDrop result:', handled);
      if (!handled) {
        console.warn('⚠️ [EnhancedElementHandle] Drop not handled by unified handler');
      }
    } catch (error) {
      console.error('❌ [EnhancedElementHandle] Error in handleDrop:', error);
      console.error('❌ [EnhancedElementHandle] Error stack:', error.stack);
    }

    console.log('🎯 [EnhancedElementHandle] ===== DROP END =====');
  };

  const handleMouseEnter = () => {
    console.log('🖱️ [EnhancedElementHandle] Mouse enter:', elementId);
    try {
      setIsHovered(true);
      console.log('🖱️ [EnhancedElementHandle] Hover state set to true');
    } catch (error) {
      console.error('❌ [EnhancedElementHandle] Error in handleMouseEnter:', error);
    }
  };

  const handleMouseLeave = () => {
    console.log('🖱️ [EnhancedElementHandle] Mouse leave:', elementId);
    try {
      setIsHovered(false);
      console.log('🖱️ [EnhancedElementHandle] Hover state set to false');
    } catch (error) {
      console.error('❌ [EnhancedElementHandle] Error in handleMouseLeave:', error);
    }
  };

  return (
    <div
      ref={elementRef}
      className={`enhanced-element-handle ${isHovered ? 'hovered' : ''} ${isDragging ? 'dragging' : ''}`}
      data-element-id={elementId}
      data-block-id={blockId}
      data-element-drag-handle="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* Element Drag Handle - аналогично BlockHandle */}
      <div
        className={`element-drag-handle-icon ${isHovered ? 'visible' : ''}`}
        data-element-id={elementId}
        data-block-id={blockId}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title="Перетащить элемент"
        style={{
          position: 'absolute',
          left: '-25px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '18px',
          height: '18px',
          cursor: 'grab',
          background: '#3b82f6',
          border: '1px solid #1e40af',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          color: 'white',
          zIndex: 100,
          userSelect: 'none',
          opacity: isHovered ? '1' : '0.8',
          transition: 'opacity 0.2s ease',
          pointerEvents: 'auto'
        }}
      >
        ⋮⋮
      </div>

      {/* Drop Indicator - Before */}
      {dragOverPosition === 'before' && (
        <div
          className="element-drop-indicator element-drop-indicator-before"
          style={{
            position: 'absolute',
            top: '-2px',
            left: '0',
            right: '0',
            height: '2px',
            background: '#3b82f6',
            borderRadius: '1px',
            zIndex: 99
          }}
        />
      )}

      {/* Element Content */}
      <div className="element-content">
        {children}
      </div>

      {/* Drop Indicator - After */}
      {dragOverPosition === 'after' && (
        <div
          className="element-drop-indicator element-drop-indicator-after"
          style={{
            position: 'absolute',
            bottom: '-2px',
            left: '0',
            right: '0',
            height: '2px',
            background: '#3b82f6',
            borderRadius: '1px',
            zIndex: 99
          }}
        />
      )}
    </div>
  );
};