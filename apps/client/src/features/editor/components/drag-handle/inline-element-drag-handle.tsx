import React, { useState, useCallback } from 'react';
import { createLarkGhost } from '../../utils/dnd/ghost';

export interface InlineElementDragHandleProps {
  elementId: string;
  blockId: string;
  elementType: string;
  onDragStart?: (elementId: string, blockId: string) => void;
  onDragEnd?: (elementId: string, blockId: string) => void;
  onElementMove?: (sourceId: string, targetId: string, position: 'before' | 'after', sourceBlockId: string, targetBlockId: string) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const InlineElementDragHandle: React.FC<InlineElementDragHandleProps> = ({
  elementId,
  blockId,
  elementType,
  onDragStart,
  onDragEnd,
  onElementMove,
  children,
  className = '',
  style = {}
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDragStart = useCallback((event: React.DragEvent) => {
    console.log('🎯 [InlineElementDragHandle] ===== DRAG START =====');
    console.log('🎯 [InlineElementDragHandle] Element ID:', elementId);
    console.log('🎯 [InlineElementDragHandle] Block ID:', blockId);
    console.log('🎯 [InlineElementDragHandle] Element type:', elementType);
    console.log('🎯 [InlineElementDragHandle] Event type:', event.type);

    try {
      setIsDragging(true);
      
      // Set drag data
      event.dataTransfer.setData('application/element', JSON.stringify({
        elementId,
        blockId,
        elementType,
        version: '2.0'
      }));
      
      event.dataTransfer.setData('application/element-type', elementType);
      event.dataTransfer.setData('application/parent-block', blockId);
      
      // Set drag effect
      event.dataTransfer.effectAllowed = 'move';
      
      // Create ghost element
      const ghostType = elementType === 'list-item' ? 'list-item' : 'block';
      createLarkGhost(event.currentTarget as HTMLElement, ghostType);
      
      console.log('🎯 [InlineElementDragHandle] Drag data set successfully');
      console.log('🎯 [InlineElementDragHandle] Ghost element created');
      
      // Call callback
      if (onDragStart) {
        onDragStart(elementId, blockId);
      }
      
      console.log('✅ [InlineElementDragHandle] ===== DRAG START SUCCESS =====');
    } catch (error) {
      console.error('❌ [InlineElementDragHandle] Error in handleDragStart:', error);
      console.error('❌ [InlineElementDragHandle] Error stack:', error.stack);
    }
  }, [elementId, blockId, elementType, onDragStart]);

  const handleDragEnd = useCallback((event: React.DragEvent) => {
    console.log('🏁 [InlineElementDragHandle] ===== DRAG END =====');
    console.log('🏁 [InlineElementDragHandle] Element ID:', elementId);
    console.log('🏁 [InlineElementDragHandle] Block ID:', blockId);
    console.log('🏁 [InlineElementDragHandle] Event type:', event.type);
    console.log('🏁 [InlineElementDragHandle] DataTransfer dropEffect:', event.dataTransfer.dropEffect);
    console.log('🏁 [InlineElementDragHandle] DataTransfer effectAllowed:', event.dataTransfer.effectAllowed);

    try {
      setIsDragging(false);
      
      // Call callback
      if (onDragEnd) {
        onDragEnd(elementId, blockId);
      }
      
      console.log('✅ [InlineElementDragHandle] ===== DRAG END SUCCESS =====');
    } catch (error) {
      console.error('❌ [InlineElementDragHandle] Error in handleDragEnd:', error);
      console.error('❌ [InlineElementDragHandle] Error stack:', error.stack);
    }
  }, [elementId, blockId, onDragEnd]);

  const handleMouseEnter = useCallback(() => {
    console.log('🖱️ [InlineElementDragHandle] Mouse enter:', elementId);
    setIsHovered(true);
  }, [elementId]);

  const handleMouseLeave = useCallback(() => {
    console.log('🖱️ [InlineElementDragHandle] Mouse leave:', elementId);
    setIsHovered(false);
  }, [elementId]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    console.log('🎯 [InlineElementDragHandle] ===== DROP =====');
    console.log('🎯 [InlineElementDragHandle] Element ID:', elementId);
    console.log('🎯 [InlineElementDragHandle] Block ID:', blockId);
    console.log('🎯 [InlineElementDragHandle] Event type:', event.type);

    try {
      event.preventDefault();
      event.stopPropagation();

      // Get drag data
      const elementData = event.dataTransfer.getData('application/element');
      if (!elementData) {
        console.warn('⚠️ [InlineElementDragHandle] No element data found');
        return;
      }

      const dragData = JSON.parse(elementData);
      console.log('🎯 [InlineElementDragHandle] Drag data:', dragData);

      // Check if it's a valid element drop
      if (dragData.type !== 'element' && !dragData.elementId) {
        console.warn('⚠️ [InlineElementDragHandle] Invalid element drop data');
        return;
      }

      // Determine drop position (simplified - always 'after' for inline elements)
      const position: 'before' | 'after' = 'after';
      
      // Call element move callback
      if (onElementMove && dragData.elementId !== elementId) {
        onElementMove(
          dragData.elementId,
          elementId,
          position,
          dragData.blockId,
          blockId
        );
      }

      console.log('✅ [InlineElementDragHandle] ===== DROP SUCCESS =====');
    } catch (error) {
      console.error('❌ [InlineElementDragHandle] Error in handleDrop:', error);
      console.error('❌ [InlineElementDragHandle] Error stack:', error.stack);
    }
  }, [elementId, blockId, onElementMove]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    // Allow drop for element types
    const elementData = event.dataTransfer.getData('application/element');
    if (elementData) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }
  }, []);

  return (
    <div
      className={`inline-element-drag-handle ${isDragging ? 'dragging' : ''} ${isHovered ? 'hovered' : ''} ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-element-id={elementId}
      data-block-id={blockId}
      data-element-type={elementType}
      data-inline-drag-handle="true"
    >
      {children}
      
      {/* Inline drag handle icon */}
      {isHovered && (
        <div
          className="inline-drag-handle-icon"
          style={{
            position: 'absolute',
            left: '-20px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '12px',
            cursor: 'grab',
            background: '#3b82f6',
            border: '1px solid #1e40af',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            color: 'white',
            zIndex: 100,
            userSelect: 'none',
            opacity: 0.8,
            transition: 'opacity 0.2s',
            pointerEvents: 'auto'
          }}
          title="Перетащить элемент"
        >
          ⋮
        </div>
      )}
    </div>
  );
};
