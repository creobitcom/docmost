import React from 'react';

interface ElementHandleProps {
  elementId: string;
  blockId: string;
  onDragStart?: (elementId: string, blockId: string) => void;
  onDragEnd?: () => void;
}

export const ElementHandle: React.FC<ElementHandleProps> = ({ 
  elementId, 
  blockId,
  onDragStart, 
  onDragEnd 
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    const payload = {
      type: 'element',
      elementId,
      sourceBlockId: blockId
    };
    
    e.dataTransfer?.setData('application/json', JSON.stringify(payload));
    e.dataTransfer?.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer?.setData('application/element', elementId);
    e.dataTransfer?.setData('application/x-block-id', blockId);
    
    onDragStart?.(elementId, blockId);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <div
      className="element-drag-handle"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        position: 'absolute',
        left: -30,
        top: 0,
        width: 20,
        height: 20,
        cursor: 'grab',
        background: '#10b981',
        border: '2px solid #ffffff',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        color: 'white',
        zIndex: 9999,
        userSelect: 'none',
        opacity: 0.8,
        transition: 'opacity 0.2s ease',
        pointerEvents: 'auto',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }}
      title="Перетащите элемент"
    >
      ⋮⋮
    </div>
  );
};
