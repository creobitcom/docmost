import React, { useState, useRef, useEffect } from 'react';
import { IconGripVertical } from '@tabler/icons-react';
import { EditorView } from 'prosemirror-view';
import { createLarkGhost, disableDefaultDragImage } from '../../utils/dnd/ghost';
import { dndCoordinator, DndPayload } from '../../dnd/DndCoordinator';
import { handleUnifiedDragStart, handleUnifiedDragOver, handleUnifiedDrop, cleanupDragState, clearDragOverCache } from '../../utils/unified-drag-handlers';
import { UnifiedDragData } from '../../types/drag-types';
import { dragDebugLogger } from '../../utils/drag-debug-logger';


interface EnhancedBlockHandleProps {
  blockId: string;
  view?: EditorView;
  onDragStart?: (blockId: string) => void;
  onDragEnd?: (blockId: string) => void;
  onBlockDrop?: (sourceBlockId: string, targetBlockId: string, position: 'before' | 'after') => void;
  onElementDrop?: (sourceElementId: string, targetElementId: string, position: 'before' | 'after') => void;
  children?: React.ReactNode;
}

// Throttling для логов
let lastElementDragLogTime = 0;
const ELEMENT_DRAG_LOG_THROTTLE_MS = 2000; // 2 секунды

export const EnhancedBlockHandle: React.FC<EnhancedBlockHandleProps> = ({
  blockId,
  view,
  onDragStart,
  onDragEnd,
  onBlockDrop,
  onElementDrop,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | 'inside' | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  // Устанавливаем data-dnd-id для блока
  useEffect(() => {
    if (blockRef.current) {
      blockRef.current.setAttribute('data-dnd-id', blockId);
      blockRef.current.setAttribute('data-block-id', blockId);
    }
  }, [blockId]);

  // Логируем монтаж компонента только один раз
  useEffect(() => {
    return () => {
      // Cleanup при размонтировании
    };
  }, []);

  // Global drag event listeners для визуальной обратной связи
  useEffect(() => {
    const handleGlobalElementDragStart = (event: CustomEvent) => {
      const payload = event.detail;
      if (payload && payload.sourceBlockId !== blockId && blockRef.current) {
        // Подсвечиваем блок как потенциальную цель для cross-block операции
        blockRef.current.classList.add('cross-block-target');
        document.body.setAttribute('data-drag-type', 'cross-block');
      }
    };

    const handleGlobalElementDragEnd = () => {
      if (blockRef.current) {
        blockRef.current.classList.remove('cross-block-target');
      }
    };

    // Добавляем глобальный слушатель для drop событий для отладки
    const handleGlobalDrop = (event: DragEvent) => {
      // Глобальный drop обработчик для отладки
    };

    document.addEventListener('global-element-drag-start', handleGlobalElementDragStart as EventListener);
    document.addEventListener('global-element-drag-end', handleGlobalElementDragEnd as EventListener);
    document.addEventListener('drop', handleGlobalDrop, true);

    return () => {
      document.removeEventListener('global-element-drag-start', handleGlobalElementDragStart as EventListener);
      document.removeEventListener('global-element-drag-end', handleGlobalElementDragEnd as EventListener);
      document.removeEventListener('drop', handleGlobalDrop, true);
    };
  }, [blockId]);

  // Добавляем mousedown listener для обнаружения намерения drag элемента
  useEffect(() => {
    const blockElement = blockRef.current;
    if (!blockElement) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isElementHandle = target.closest('[data-element-drag-handle="true"]');

      if (isElementHandle) {
        // Устанавливаем флаг для потенциального element drag
        const currentState = (window as any).__dragState;
        if (currentState && typeof currentState === 'object' && !('type' in currentState)) {
          (currentState as any).potentialElementDrag = true;
          (currentState as any).currentElementId = isElementHandle.getAttribute('data-element-id') || undefined;
        }
      }
    };

    blockElement.addEventListener('mousedown', handleMouseDown, true);

    return () => {
      blockElement.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [blockId]);

  const handleDragStart = async (event: React.DragEvent) => {
    // Начинаем новую операцию логирования
    const operationId = dragDebugLogger.startOperation();

    try {
      // Простая проверка - если это element drag handle, не обрабатываем
      const target = event.target as HTMLElement;
      const isElementDragHandle = target.closest('[data-element-drag-handle="true"]');

      if (isElementDragHandle) {
        console.log('⚠️ [EnhancedBlockHandle] Element drag handle detected, ignoring block drag');
        return; // Просто выходим без preventDefault/stopPropagation
      }

      setIsDragging(true);
      onDragStart?.(blockId);

      // Отключаем стандартный drag image
      disableDefaultDragImage(event.nativeEvent as DragEvent);

      // Создаем ghost элемент
      if (blockRef.current) {
        createLarkGhost(
          blockRef.current,
          'block',
          event.clientX,
          event.clientY
        );
      }

      // 🎯 ИСПОЛЬЗУЕМ УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ
      // Создаем правильное событие с currentTarget
      const nativeEvent = event.nativeEvent as DragEvent;
      Object.defineProperty(nativeEvent, 'currentTarget', {
        value: event.currentTarget,
        writable: false
      });
      const dragData = await handleUnifiedDragStart(nativeEvent);

      // Логируем drag start в централизованную систему
      dragDebugLogger.logDragStart(
        blockRef.current,
        null, // elementId для блоков
        blockId,
        'block',
        event.dataTransfer,
        { x: event.clientX, y: event.clientY },
        target
      );
    } catch (error) {
      console.error('❌ [EnhancedBlockHandle] Error in handleDragStart:', error);
      console.error('❌ [EnhancedBlockHandle] Error stack:', error.stack);
    }

    console.log('🎯 [EnhancedBlockHandle] ===== BLOCK DRAG START END =====');
  };

  const handleDragEnd = (event: React.DragEvent) => {
    // Логируем drag end в централизованную систему
    dragDebugLogger.logDragEnd(
      event.dataTransfer?.dropEffect === 'move',
      event.dataTransfer?.dropEffect || 'none',
      event.dataTransfer?.effectAllowed || 'none',
      true // cleanupPerformed
    );

    try {
      setIsDragging(false);
      onDragEnd?.(blockId);

      // Очищаем ghost элемент
      const ghostElement = document.querySelector('.lark-ghost');
      if (ghostElement && ghostElement.parentNode) {
        ghostElement.parentNode.removeChild(ghostElement);
      }

      // Очистка drag состояния
      cleanupDragState();
      clearDragOverCache();
    } catch (error) {
      console.error('❌ [EnhancedBlockHandle] Error in handleDragEnd:', error);
      console.error('❌ [EnhancedBlockHandle] Error stack:', error.stack);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    try {
      // Проверяем, не является ли это element drag событием
      const target = event.target as HTMLElement;
      const isElementHandle = target.closest('[data-element-drag-handle="true"]');
      const isElement = target.closest('li, [data-checked]');
      const isElementContent = target.closest('li p, li div, li label');

      if (isElementHandle || isElement || isElementContent) {
        // Throttling для логов - логируем не чаще чем раз в 2 секунды
        const now = Date.now();
        if (now - lastElementDragLogTime > ELEMENT_DRAG_LOG_THROTTLE_MS) {
          console.log('⚠️ [EnhancedBlockHandle] Element drag detected, ignoring block dragover');
          lastElementDragLogTime = now;
        }
        return; // Игнорируем element drag события
      }

      // 🎯 ИСПОЛЬЗУЕМ УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ
      // Создаем правильное событие с currentTarget
      const nativeEvent = event.nativeEvent as DragEvent;
      Object.defineProperty(nativeEvent, 'currentTarget', {
        value: event.currentTarget,
        writable: false
      });
      const handled = handleUnifiedDragOver(nativeEvent);

      if (handled) {
        // Определяем позицию для drop для визуальных индикаторов
        const rect = event.currentTarget.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const height = rect.height;

        let position: 'before' | 'after' | 'inside';

        if (y < height * 0.25) {
          position = 'before';
        } else if (y > height * 0.75) {
          position = 'after';
        } else {
          position = 'inside';
        }

        setDragOverPosition(position);

        // 🔧 ИСПРАВЛЕНИЕ: Сохраняем позицию мыши для использования в drop
        if (blockRef.current) {
          (blockRef.current as any).__lastMouseY = event.clientY;
        }

        // Логируем drag over в централизованную систему
        dragDebugLogger.logDragOver(
          event.currentTarget as HTMLElement,
          blockId,
          position,
          { x: event.clientX, y: event.clientY },
          event.dataTransfer
        );

        // Add visual feedback
        if (blockRef.current) {
          blockRef.current.style.borderColor = '#3b82f6';
          blockRef.current.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
        }

        // Принудительно предотвращаем default поведение
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (error) {
      console.error('❌ [EnhancedBlockHandle] Error in handleDragOver:', error);
      console.error('❌ [EnhancedBlockHandle] Error stack:', error.stack);
    }
  };

  const handleDragLeave = () => {
    try {
      setDragOverPosition(null);

      // Remove visual feedback
      if (blockRef.current) {
        blockRef.current.style.borderColor = 'transparent';
        blockRef.current.style.backgroundColor = 'transparent';
      }
    } catch (error) {
      console.error('❌ [EnhancedBlockHandle] Error in handleDragLeave:', error);
      console.error('❌ [EnhancedBlockHandle] Error stack:', error.stack);
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();

    try {
      // Проверяем, не является ли это element drop событием
      const target = event.target as HTMLElement;
      const isElementHandle = target.closest('[data-element-drag-handle="true"]');
      const isElement = target.closest('li, [data-checked]');
      const isElementContent = target.closest('li p, li div, li label');

      if (isElementHandle || isElement || isElementContent) {
        console.log('⚠️ [EnhancedBlockHandle] Element drop detected, ignoring block drop');
        return; // Игнорируем element drop события
      }

      // 🎯 ИСПОЛЬЗУЕМ УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ
      // Создаем правильное событие с currentTarget
      const nativeEvent = event.nativeEvent as DragEvent;
      Object.defineProperty(nativeEvent, 'currentTarget', {
        value: event.currentTarget,
        writable: false
      });
      const handled = await handleUnifiedDrop(
        nativeEvent,
        (sourceBlockId, sourceElementId, targetBlockId, beforeElementId) => {
          console.log('✅ [EnhancedBlockHandle] Element drop handled:', {
            sourceBlockId,
            sourceElementId,
            targetBlockId,
            beforeElementId,
            isCrossBlock: sourceBlockId !== targetBlockId
          });

          // Диспатчим событие для cross-block element move
          console.log('🔄 [EnhancedBlockHandle] ===== CROSS-BLOCK ELEMENT MOVE FROM BLOCK HANDLE =====');
          console.log('🔄 [EnhancedBlockHandle] Source element ID:', sourceElementId);
          console.log('🔄 [EnhancedBlockHandle] Source block ID:', sourceBlockId);
          console.log('🔄 [EnhancedBlockHandle] Target block ID:', targetBlockId);
          console.log('🔄 [EnhancedBlockHandle] Before element ID:', beforeElementId);

          // 🔧 ИСПРАВЛЕНИЕ: Определяем позицию на основе координат мыши
          let targetPosition: 'before' | 'after' = 'after';
          let finalBeforeElementId = beforeElementId;

          // Если unified handlers не определил позицию, определяем сами
          if (!beforeElementId && blockRef.current) {
            const lastMouseY = (blockRef.current as any).__lastMouseY;
            if (lastMouseY) {
              // Получаем все элементы в блоке
              const allElements = blockRef.current.querySelectorAll('[data-element-id]');
              if (allElements.length > 0) {
                // Находим ближайший элемент по Y координате
                let closestElement = null;
                let closestDistance = Infinity;
                let insertIndex = 0;

                allElements.forEach((element, index) => {
                  const rect = element.getBoundingClientRect();
                  const elementCenterY = rect.top + rect.height / 2;
                  const distance = Math.abs(lastMouseY - elementCenterY);

                  if (distance < closestDistance) {
                    closestDistance = distance;
                    closestElement = element;
                    insertIndex = index;
                  }
                });

                if (closestElement) {
                  const rect = closestElement.getBoundingClientRect();
                  const elementCenterY = rect.top + rect.height / 2;

                  if (lastMouseY < elementCenterY) {
                    // Вставляем перед ближайшим элементом
                    finalBeforeElementId = closestElement.getAttribute('data-element-id') || undefined;
                    targetPosition = 'before';
                  } else {
                    // Вставляем после ближайшего элемента
                    const nextElement = allElements[insertIndex + 1] as HTMLElement;
                    finalBeforeElementId = nextElement?.getAttribute('data-element-id') || undefined;
                    targetPosition = 'after';
                  }
                }
              }
            }
          }

          console.log('🔄 [EnhancedBlockHandle] Target position:', targetPosition);
          console.log('🔄 [EnhancedBlockHandle] Is cross-block?', sourceBlockId !== targetBlockId);

          if (sourceBlockId !== targetBlockId) {
            const eventDetail = {
              elementId: sourceElementId,
              sourceBlockId,
              targetBlockId,
              targetPosition,
              beforeElementId: finalBeforeElementId
            };

            console.log('🔄 [EnhancedBlockHandle] Creating cross-block event with detail:', eventDetail);
            const crossBlockEvent = new CustomEvent('cross-block-element-move', {
              detail: eventDetail
            });

            console.log('🔄 [EnhancedBlockHandle] Event created:', {
              type: crossBlockEvent.type,
              detail: crossBlockEvent.detail,
              bubbles: crossBlockEvent.bubbles,
              cancelable: crossBlockEvent.cancelable
            });

            console.log('🔄 [EnhancedBlockHandle] Dispatching cross-block event...');
            document.dispatchEvent(crossBlockEvent);
            console.log('✅ [EnhancedBlockHandle] Cross-block element move event dispatched successfully');
            console.log('✅ [EnhancedBlockHandle] ===== CROSS-BLOCK ELEMENT MOVE COMPLETED =====');
          } else {
            console.log('🔄 [EnhancedBlockHandle] Same block move detected, skipping cross-block event');
          }
        },
        (sourceBlockId, targetBlockId) => {
          console.log('✅ [EnhancedBlockHandle] Block drop handled:', {
            sourceBlockId,
            targetBlockId,
            currentDragOverPosition: dragOverPosition
          });

          // Вызываем callback для перемещения блока
          const position = dragOverPosition === 'inside' ? 'after' : (dragOverPosition || 'after');
          console.log('🔄 [EnhancedBlockHandle] Calling onBlockDrop with position:', position);
          onBlockDrop?.(sourceBlockId, targetBlockId, position);
          console.log('✅ [EnhancedBlockHandle] onBlockDrop callback called');
        }
      );

      // Логируем drop в централизованную систему
      dragDebugLogger.logDrop(
        event.currentTarget as HTMLElement,
        blockId,
        dragOverPosition || 'after',
        { x: event.clientX, y: event.clientY },
        event.dataTransfer,
        handled,
        handled ? undefined : 'Drop not handled by unified handler'
      );

      setDragOverPosition(null);

      // Remove visual feedback
      if (blockRef.current) {
        blockRef.current.style.borderColor = 'transparent';
        blockRef.current.style.backgroundColor = 'transparent';
      }
    } catch (error) {
      console.error('❌ [EnhancedBlockHandle] Error in handleDrop:', error);
      console.error('❌ [EnhancedBlockHandle] Error stack:', error.stack);
    }
  };

  const handleMouseEnter = () => {
    try {
      setIsHovered(true);
    } catch (error) {
      console.error('❌ [EnhancedBlockHandle] Error in handleMouseEnter:', error);
    }
  };

  const handleMouseLeave = () => {
    try {
      setIsHovered(false);
    } catch (error) {
      console.error('❌ [EnhancedBlockHandle] Error in handleMouseLeave:', error);
    }
  };

  return (
    <div
      ref={blockRef}
      className={`enhanced-block-handle ${isHovered ? 'hovered' : ''} ${isDragging ? 'dragging' : ''}`}
      data-block-id={blockId}
      data-drop-zone="true"
      data-drop-zone-type="block"
      data-global-drag-handle="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minHeight: '50px',
        border: '1px solid transparent',
        transition: 'border-color 0.2s'
      }}
    >
      {/* Drag Handle */}
      <div
        className={`drag-handle-icon ${isHovered ? 'visible' : ''}`}
        data-global-drag-handle="true"
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title="Перетащить блок"
        style={{ pointerEvents: 'auto' }}
      >
        <IconGripVertical size={14} strokeWidth={2} />
      </div>

      {/* Drop Indicator - Before */}
      {dragOverPosition === 'before' && (
        <div className="drop-indicator drop-indicator-before" />
      )}

      {/* Block Content */}
      <div className="block-content">
        {children}
      </div>

      {/* Drop Indicator - After */}
      {dragOverPosition === 'after' && (
        <div className="drop-indicator drop-indicator-after" />
      )}

    </div>
  );
};