import React, { useRef, useState } from 'react';
import { IconGripVertical } from '@tabler/icons-react';
import { createLarkGhost } from '../../utils/dnd/ghost';

interface BlockWrapperProps {
  blockId: string;
  className?: string;
  children: React.ReactNode;
  onDrop?: (sourceBlockId: string, targetBlockId: string, position: 'before' | 'after') => void;
  block?: any; // Добавляем блок для проверки обязательности
}

export const BlockWrapper: React.FC<BlockWrapperProps> = ({
  blockId,
  className = '',
  children,
  onDrop,
  block
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (event: React.DragEvent) => {
    event.stopPropagation();
    
    if (!blockRef.current) return;

    setIsDragging(true);
    
    // Устанавливаем данные для drag
    event.dataTransfer?.setData('application/block', blockId);
    event.dataTransfer?.setData('text/plain', `block:${blockId}`);
    event.dataTransfer!.effectAllowed = 'move';

    // Создаем Lark-style ghost
    createLarkGhost(blockRef.current, 'block', event.clientX, event.clientY);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!blockRef.current) return;

    const rect = blockRef.current.getBoundingClientRect();
    const y = event.clientY;
    const threshold = rect.top + rect.height / 2;

    const position = y < threshold ? 'before' : 'after';
    setDragOverPosition(position);
  };

  const handleDragLeave = () => {
    setDragOverPosition(null);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();

    // Проверяем тип drag операции
    const blockData = event.dataTransfer.getData('application/block');
    const elementData = event.dataTransfer.getData('application/element');

    if (blockData && blockData !== blockId && dragOverPosition) {
      // Это drag блока
      onDrop?.(`block:${blockData}`, blockId, dragOverPosition);
    } else if (elementData) {
      // Это drag элемента - обрабатываем через ProseMirror
      console.log('[BlockWrapper] Element drop detected:', {
        elementId: elementData,
        targetBlockId: blockId,
        position: dragOverPosition || 'after'
      });
      
      // Создаем кастомное событие для ProseMirror
      const customDropEvent = new CustomEvent('element-drop', {
        detail: {
          elementId: elementData,
          targetBlockId: blockId,
          position: dragOverPosition || 'after'
        }
      });
      
      document.dispatchEvent(customDropEvent);
    }

    setDragOverPosition(null);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      ref={blockRef}
      className={`block-wrapper ${className} ${isDragging ? 'dragging' : ''} ${isHovered ? 'hovered' : ''}`}
      data-block-id={blockId}
      data-drop-zone="true"
      data-drop-zone-type="block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
