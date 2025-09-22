import React from 'react';

interface BlockHandleProps {
  blockId: string;
  onDragStart?: (blockId: string) => void;
  onDragEnd?: () => void;
}

export const BlockHandle: React.FC<BlockHandleProps> = ({ 
  blockId, 
  onDragStart, 
  onDragEnd 
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer?.setData('application/block-id', blockId);
    e.dataTransfer?.setData('text/plain', `block-${blockId}`);
    onDragStart?.(blockId);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <div
      className="block-drag-handle"
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
        background: '#3b82f6',
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
      title="Перетащите блок"
    >
      ⋮⋮
    </div>
  );
};
