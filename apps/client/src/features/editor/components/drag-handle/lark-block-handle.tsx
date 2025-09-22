import React from 'react';

interface LarkBlockHandleProps {
  blockId: string;
  onDragStart?: (blockId: string) => void;
  onDragEnd?: () => void;
}

export const LarkBlockHandle: React.FC<LarkBlockHandleProps> = ({ 
  blockId, 
  onDragStart, 
  onDragEnd 
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer?.setData('application/lark-block', blockId);
    e.dataTransfer?.setData('text/plain', `lark-block-${blockId}`);
    onDragStart?.(blockId);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <div
      className="lark-block-handle"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        position: 'absolute',
        left: -40,
        top: 0,
        width: 24,
        height: 24,
        cursor: 'grab',
        background: '#f59e0b',
        border: '2px solid #ffffff',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        color: 'white',
        zIndex: 9999,
        userSelect: 'none',
        opacity: 0.9,
        transition: 'all 0.2s ease',
        pointerEvents: 'auto',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
      }}
      title="Перетащите блок (Lark стиль)"
    >
      ⋮⋮
    </div>
  );
};
