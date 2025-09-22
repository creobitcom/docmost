import React from 'react';
import { IconGripVertical } from '@tabler/icons-react';
import { createLarkGhost } from '../../utils/dnd/ghost';

interface ElementDragHandleViewProps {
  elementId: string;
  elementType: 'list-item' | 'table-row' | 'element';
  className?: string;
  children: React.ReactNode;
}

export const ElementDragHandleView: React.FC<ElementDragHandleViewProps> = ({
  elementId,
  elementType,
  className = '',
  children
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const elementRef = React.useRef<HTMLDivElement>(null);

  const handleDragStart = (event: React.DragEvent) => {
    event.stopPropagation();
    
    if (!elementRef.current) return;

    setIsDragging(true);
    
    // Устанавливаем данные для drag
    event.dataTransfer?.setData('application/element', elementId);
    event.dataTransfer?.setData('text/plain', `element:${elementId}`);
    event.dataTransfer!.effectAllowed = 'move';

    // Создаем Lark-style ghost
    const ghostType = elementType === 'list-item' ? 'list-item' : 'element';
    createLarkGhost(elementRef.current, ghostType as 'block' | 'list-item' | 'table-row' | 'element', event.clientX, event.clientY);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      ref={elementRef}
      className={`element-drag-handle-view ${className} ${isDragging ? 'dragging' : ''} ${isHovered ? 'hovered' : ''}`}
      data-element-id={elementId}
      data-element-type={elementType}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Drag Handle */}
      <div
        className={`drag-handle-icon ${isHovered ? 'visible' : ''}`}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title="Перетащить элемент"
        style={{ pointerEvents: 'auto' }}
      >
        <IconGripVertical size={12} strokeWidth={2} />
      </div>

      {/* Element Content */}
      <div className="element-content">
        {children}
      </div>
    </div>
  );
};
