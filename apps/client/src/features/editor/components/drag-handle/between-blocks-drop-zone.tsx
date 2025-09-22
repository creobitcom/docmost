import React, { useState, useRef, useEffect } from 'react';
import { handleUnifiedDragOver, handleUnifiedDrop, cleanupDragState } from '../../utils/unified-drag-handlers';
import { DragStateManager } from '../../utils/drag-state-manager';

interface BetweenBlocksDropZoneProps {
  afterBlockId: string;
  beforeBlockId?: string;
  onElementDropBetweenBlocks: (sourceElementId: string, sourceBlockId: string, afterBlockId: string, beforeBlockId?: string) => void;
  className?: string;
}

export const BetweenBlocksDropZone: React.FC<BetweenBlocksDropZoneProps> = ({
  afterBlockId,
  beforeBlockId,
  onElementDropBetweenBlocks,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Показываем дроп зону при наведении элемента
  useEffect(() => {
    const handleGlobalElementDragStart = (event: CustomEvent) => {
      const payload = event.detail;
      if (payload && payload.type === 'element') {
        console.log('🎯 [BetweenBlocksDropZone] Element drag detected, showing drop zone');
        setIsVisible(true);
      }
    };

    const handleGlobalElementDragEnd = () => {
      console.log('🎯 [BetweenBlocksDropZone] Element drag ended, hiding drop zone');
      setIsVisible(false);
      setIsDragOver(false);
    };

    document.addEventListener('global-element-drag-start', handleGlobalElementDragStart as EventListener);
    document.addEventListener('global-element-drag-end', handleGlobalElementDragEnd as EventListener);

    return () => {
      document.removeEventListener('global-element-drag-start', handleGlobalElementDragStart as EventListener);
      document.removeEventListener('global-element-drag-end', handleGlobalElementDragEnd as EventListener);
    };
  }, []);

  const handleDragOver = (event: React.DragEvent) => {
    console.log('🔄 [BetweenBlocksDropZone] ===== DRAG OVER BETWEEN BLOCKS =====');
    console.log('🔄 [BetweenBlocksDropZone] After block ID:', afterBlockId);
    console.log('🔄 [BetweenBlocksDropZone] Before block ID:', beforeBlockId);
    console.log('🔄 [BetweenBlocksDropZone] Event clientY:', event.clientY);

    try {
      // Проверяем, что это перетаскивание элемента
      const dragData = DragStateManager.get();
      if (!dragData || dragData.type !== 'element') {
        console.log('⚠️ [BetweenBlocksDropZone] Not an element drag, ignoring');
        return;
      }

      console.log('✅ [BetweenBlocksDropZone] Element drag confirmed, processing...');

      // Используем унифицированный обработчик
      const handled = handleUnifiedDragOver(event.nativeEvent);
      
      if (handled) {
        console.log('✅ [BetweenBlocksDropZone] Drag over handled successfully');
        setIsDragOver(true);
        
        // Предотвращаем стандартное поведение
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (error) {
      console.error('❌ [BetweenBlocksDropZone] Error in handleDragOver:', error);
    }

    console.log('🔄 [BetweenBlocksDropZone] ===== DRAG OVER END =====');
  };

  const handleDragLeave = (event: React.DragEvent) => {
    // Проверяем, что мы действительно покидаем дроп зону
    if (dropZoneRef.current && !dropZoneRef.current.contains(event.relatedTarget as Node)) {
      console.log('🚪 [BetweenBlocksDropZone] Drag leave confirmed');
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    console.log('🎯 [BetweenBlocksDropZone] ===== DROP BETWEEN BLOCKS =====');
    console.log('🎯 [BetweenBlocksDropZone] After block ID:', afterBlockId);
    console.log('🎯 [BetweenBlocksDropZone] Before block ID:', beforeBlockId);

    try {
      event.preventDefault();
      event.stopPropagation();

      // Используем унифицированный обработчик с кастомным callback
      const handled = handleUnifiedDrop(
        event.nativeEvent,
        (sourceBlockId, sourceElementId, targetBlockId, beforeElementId) => {
          console.log('✅ [BetweenBlocksDropZone] Element drop handled:', {
            sourceBlockId,
            sourceElementId,
            targetBlockId,
            beforeElementId
          });

          // Вызываем callback для создания нового блока между существующими
          console.log('🔄 [BetweenBlocksDropZone] Calling onElementDropBetweenBlocks...');
          onElementDropBetweenBlocks(sourceElementId, sourceBlockId, afterBlockId, beforeBlockId);
          console.log('✅ [BetweenBlocksDropZone] onElementDropBetweenBlocks called');
        }
      );

      if (handled) {
        console.log('✅ [BetweenBlocksDropZone] Drop handled successfully');
      } else {
        console.warn('⚠️ [BetweenBlocksDropZone] Drop not handled');
      }

      // Очищаем состояние
      setIsDragOver(false);
      setIsVisible(false);
      cleanupDragState();
    } catch (error) {
      console.error('❌ [BetweenBlocksDropZone] Error in handleDrop:', error);
    }

    console.log('🎯 [BetweenBlocksDropZone] ===== DROP END =====');
  };

  // Не рендерим, если не видима
  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={dropZoneRef}
      className={`between-blocks-drop-zone ${isDragOver ? 'drag-over' : ''} ${className}`}
      data-drop-zone="true"
      data-drop-zone-type="between-blocks"
      data-after-block-id={afterBlockId}
      data-before-block-id={beforeBlockId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minHeight: isDragOver ? '60px' : '8px',
        transition: 'all 0.2s ease'
      }}
    >
      {isDragOver && (
        <div className="drop-zone-indicator">
          <div className="drop-zone-line" />
          <div className="drop-zone-text">
            Создать новый блок
          </div>
        </div>
      )}
    </div>
  );
};
