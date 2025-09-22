import { useState, useEffect, useCallback } from 'react';

interface DragData {
  type: 'block' | 'element';
  id: string;
  sourceBlockId?: string;
  data?: any;
}

interface DropTarget {
  type: 'blockBoundary' | 'listItem' | 'blockContent';
  pos: number;
  after: boolean;
  blockId?: string;
}

interface EnhancedDndState {
  isDragging: boolean;
  dragData: DragData | null;
  dropTarget: DropTarget | null;
  lastOperation: string | null;
}

export function useEnhancedDnd() {
  const [state, setState] = useState<EnhancedDndState>({
    isDragging: false,
    dragData: null,
    dropTarget: null,
    lastOperation: null,
  });

  const startDrag = useCallback((dragData: DragData) => {
    setState(prev => ({
      ...prev,
      isDragging: true,
      dragData,
      dropTarget: null,
    }));
  }, []);

  const updateDropTarget = useCallback((dropTarget: DropTarget) => {
    setState(prev => ({
      ...prev,
      dropTarget,
    }));
  }, []);

  const endDrag = useCallback((operation: string) => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      dragData: null,
      dropTarget: null,
      lastOperation: operation,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isDragging: false,
      dragData: null,
      dropTarget: null,
      lastOperation: null,
    });
  }, []);

  useEffect(() => {
    const handleGlobalDragStart = (e: DragEvent) => {
      console.log('[useEnhancedDnd] Global drag start:', e);
    };

    const handleGlobalDragEnd = (e: DragEvent) => {
      console.log('[useEnhancedDnd] Global drag end:', e);
      endDrag('drag-end');
    };

    const handleGlobalDrop = (e: DragEvent) => {
      console.log('[useEnhancedDnd] Global drop:', e);
      endDrag('drop');
    };

    document.addEventListener('dragstart', handleGlobalDragStart);
    document.addEventListener('dragend', handleGlobalDragEnd);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      document.removeEventListener('dragstart', handleGlobalDragStart);
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, [endDrag]);

  return {
    ...state,
    startDrag,
    updateDropTarget,
    endDrag,
    reset,
  };
}
