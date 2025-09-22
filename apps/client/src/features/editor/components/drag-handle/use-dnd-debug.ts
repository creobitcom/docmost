import { useState, useEffect } from 'react';

interface DndDebugInfo {
  isDragging: boolean;
  dragType: string | null;
  dragData: any;
  dropTarget: any;
  lastOperation: string | null;
}

export function useDndDebug() {
  const [debugInfo, setDebugInfo] = useState<DndDebugInfo>({
    isDragging: false,
    dragType: null,
    dragData: null,
    dropTarget: null,
    lastOperation: null,
  });

  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      console.log('[DndDebug] Drag start:', e);
      setDebugInfo(prev => ({
        ...prev,
        isDragging: true,
        dragType: e.dataTransfer?.types?.[0] || 'unknown',
        dragData: {
          types: e.dataTransfer?.types || [],
          data: e.dataTransfer?.getData('text/plain') || '',
        },
      }));
    };

    const handleDragEnd = (e: DragEvent) => {
      console.log('[DndDebug] Drag end:', e);
      setDebugInfo(prev => ({
        ...prev,
        isDragging: false,
        dragType: null,
        dragData: null,
        dropTarget: null,
        lastOperation: 'drag-end',
      }));
    };

    const handleDrop = (e: DragEvent) => {
      console.log('[DndDebug] Drop:', e);
      setDebugInfo(prev => ({
        ...prev,
        dropTarget: {
          target: e.target,
          clientX: e.clientX,
          clientY: e.clientY,
        },
        lastOperation: 'drop',
      }));
    };

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return debugInfo;
}
