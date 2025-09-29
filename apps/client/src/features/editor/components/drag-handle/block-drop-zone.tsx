import React, { useState, useCallback, useEffect } from 'react';
import { DragStateManager } from '../../utils/drag-state-manager';

interface BlockDropZoneProps {
  blockId: string;
  position: 'before' | 'after';
  onElementExtract?: (elementId: string, targetBlockId: string, position: 'before' | 'after') => void;
  isVisible?: boolean;
  showOnHover?: boolean;
}

// Throttling для логов
let lastBlockDropZoneLogTime = 0;
const BLOCK_DROP_ZONE_LOG_THROTTLE_MS = 1000; // 1 секунда

export const BlockDropZone: React.FC<BlockDropZoneProps> = ({
  blockId,
  position,
  onElementExtract,
  isVisible = false,
  showOnHover = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Обработчик окончания drag операции
  useEffect(() => {
    const handleDragEnd = () => {
      setIsDragOver(false);
      setIsHovered(false);
    };

    // Добавляем глобальный обработчик для отладки
    const handleGlobalDragOver = (event: DragEvent) => {
      const target = event.target as HTMLElement;
      if (target && target.closest(`[data-block-id="${blockId}"][data-position="${position}"]`)) {
        console.log('🎯 [BlockDropZone] Global drag over detected on our zone:', {
          blockId,
          position,
          target: target.tagName,
          targetClasses: target.className
        });
      }
    };

    // Добавляем глобальный обработчик drop для отладки
    const handleGlobalDrop = (event: DragEvent) => {
      const target = event.target as HTMLElement;
      if (target && target.closest(`[data-block-id="${blockId}"][data-position="${position}"]`)) {
        console.log('🎯 [BlockDropZone] Global drop detected on our zone:', {
          blockId,
          position,
          target: target.tagName,
          targetClasses: target.className,
          dropEffect: event.dataTransfer?.dropEffect
        });
      }
    };

    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);
    return () => {
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, [blockId, position]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    // Throttling для логов - логируем не чаще чем раз в секунду
    const now = Date.now();
    if (now - lastBlockDropZoneLogTime > BLOCK_DROP_ZONE_LOG_THROTTLE_MS) {
      console.log('🎯 [BlockDropZone] Drag over event received:', {
        blockId,
        position,
        hasJsonData: event.dataTransfer.types.includes('application/json')
      });
      lastBlockDropZoneLogTime = now;
    }

    event.preventDefault();
    event.stopPropagation();

    const hasJsonData = event.dataTransfer.types.includes('application/json');

    if (hasJsonData) {
      const dragState = DragStateManager.get();
      if (dragState && dragState.type === 'element') {
        setIsDragOver(true);
        event.dataTransfer.dropEffect = 'copy';
        console.log('🎯 [BlockDropZone] Element drag over detected:', {
          blockId,
          position,
          elementId: dragState.elementId,
          dropEffect: event.dataTransfer.dropEffect
        });
      } else {
        setIsDragOver(false);
        event.dataTransfer.dropEffect = 'none';
      }
    } else {
      setIsDragOver(false);
      event.dataTransfer.dropEffect = 'none';
    }
  }, [blockId, position]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    // Проверяем, что мы действительно покидаем зону
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    console.log('🎯 [BlockDropZone] ===== DROP EVENT START =====');
    console.log('🎯 [BlockDropZone] Drop event received:', {
      blockId,
      position,
      hasJsonData: event.dataTransfer.types.includes('application/json'),
      dropEffect: event.dataTransfer.dropEffect,
      effectAllowed: event.dataTransfer.effectAllowed
    });

    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const hasJsonData = event.dataTransfer.types.includes('application/json');
    if (!hasJsonData) {
      console.warn('❌ [BlockDropZone] No JSON data in drop event');
      return;
    }

    const dragState = DragStateManager.get();
    if (dragState && dragState.type === 'element' && dragState.elementId) {
      console.log('🎯 [BlockDropZone] Element extraction triggered:', {
        sourceElementId: dragState.elementId,
        targetBlockId: blockId,
        position,
        hasCallback: !!onElementExtract
      });

      if (onElementExtract) {
        console.log('🎯 [BlockDropZone] Calling onElementExtract...');
        onElementExtract(dragState.elementId, blockId, position);
        console.log('✅ [BlockDropZone] onElementExtract called successfully');
      } else {
        console.error('❌ [BlockDropZone] onElementExtract callback is not defined!');
      }
    } else {
      console.warn('❌ [BlockDropZone] No valid element drag state found:', dragState);
    }

    console.log('🎯 [BlockDropZone] ===== DROP EVENT END =====');
  }, [blockId, position, onElementExtract]);

  const handleMouseEnter = useCallback(() => {
    if (showOnHover) {
      const dragState = DragStateManager.get();
      if (dragState && dragState.type === 'element') {
        setIsHovered(true);
      }
    }
  }, [showOnHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Определяем, должна ли зона быть видимой
  const shouldBeVisible = isVisible || (showOnHover && isHovered) || isDragOver;

  return (
    <div
      className={`block-drop-zone block-drop-zone-${position} ${isDragOver ? 'drag-over' : ''} ${isHovered ? 'hovered' : ''}`}
      data-block-id={blockId}
      data-position={position}
      data-drop-zone="true"
      data-drop-zone-type="block-creation"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        height: shouldBeVisible ? '30px' : '8px', // Увеличиваем размер зоны
        margin: '4px 0',
        borderRadius: '4px',
        border: isDragOver 
          ? '2px dashed #3b82f6' 
          : isHovered 
            ? '2px dashed #94a3b8' 
            : '2px dashed transparent',
        backgroundColor: isDragOver 
          ? 'rgba(59, 130, 246, 0.1)' 
          : isHovered 
            ? 'rgba(148, 163, 184, 0.05)' 
            : 'transparent',
        cursor: isDragOver ? 'copy' : isHovered ? 'pointer' : 'default',
        opacity: shouldBeVisible ? 1 : 0,
        transition: 'all 0.2s ease',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {shouldBeVisible && (
        <div style={{
          fontSize: '12px',
          color: isDragOver ? '#3b82f6' : '#94a3b8',
          fontWeight: '500',
          textAlign: 'center'
        }}>
          {isDragOver ? 'Отпустите для создания блока' : 'Перетащите элемент сюда'}
        </div>
      )}
    </div>
  );
};
