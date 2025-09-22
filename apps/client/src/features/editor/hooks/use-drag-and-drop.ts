import { useState, useCallback } from 'react';

interface DragAndDropState {
  isDragging: boolean;
  draggedBlockId: string | null;
  draggedElementId: string | null;
  dropTarget: string | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
}

interface UseDragAndDropOptions {
  onBlockMove?: (sourceBlockId: string, targetBlockId: string, position: 'before' | 'after') => void;
  onElementMove?: (sourceElementId: string, targetBlockId: string, position: 'before' | 'after' | 'inside') => void;
  onBlockCreate?: (sourceElementId: string, targetBlockId: string) => void;
  onElementDropBetweenBlocks?: (sourceElementId: string, sourceBlockId: string, afterBlockId: string, beforeBlockId?: string) => void;
}

export const useDragAndDrop = (options: UseDragAndDropOptions = {}) => {
  const [state, setState] = useState<DragAndDropState>({
    isDragging: false,
    draggedBlockId: null,
    draggedElementId: null,
    dropTarget: null,
    dropPosition: null,
  });

  const handleBlockDragStart = useCallback((blockId: string) => {
    setState(prev => ({
      ...prev,
      isDragging: true,
      draggedBlockId: blockId,
      draggedElementId: null,
    }));
  }, []);

  const handleBlockDragEnd = useCallback((blockId: string) => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedBlockId: null,
      dropTarget: null,
      dropPosition: null,
    }));
  }, []);

  const handleElementDragStart = useCallback((elementId: string) => {
    setState(prev => ({
      ...prev,
      isDragging: true,
      draggedElementId: elementId,
      draggedBlockId: null,
    }));
  }, []);

  const handleElementDragEnd = useCallback((elementId: string) => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedElementId: null,
      dropTarget: null,
      dropPosition: null,
    }));
  }, []);

  const handleBlockDrop = useCallback((
    sourceBlockId: string, 
    targetBlockId: string, 
    position: 'before' | 'after'
  ) => {
    console.log('[useDragAndDrop] handleBlockDrop called:', { sourceBlockId, targetBlockId, position });
    
    if (sourceBlockId === targetBlockId) {
      console.log('[useDragAndDrop] Same block, ignoring');
      return;
    }

    console.log('[useDragAndDrop] Calling onBlockMove with:', { sourceBlockId, targetBlockId, position });
    options.onBlockMove?.(sourceBlockId, targetBlockId, position);
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedBlockId: null,
      dropTarget: null,
      dropPosition: null,
    }));
  }, [options.onBlockMove]);

  const handleElementDrop = useCallback((
    sourceElementId: string,
    targetBlockId: string,
    position: 'before' | 'after' | 'inside'
  ) => {
    console.log('[useDragAndDrop] handleElementDrop called:', { 
      sourceElementId, 
      targetBlockId, 
      position 
    });
    
    options.onElementMove?.(sourceElementId, targetBlockId, position);
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedElementId: null,
      dropTarget: null,
      dropPosition: null,
    }));
  }, [options.onElementMove]);

  const handleBlockCreate = useCallback((
    sourceElementId: string,
    targetBlockId: string
  ) => {
    console.log('[useDragAndDrop] handleBlockCreate called:', { 
      sourceElementId, 
      targetBlockId 
    });
    
    options.onBlockCreate?.(sourceElementId, targetBlockId);
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedElementId: null,
      dropTarget: null,
      dropPosition: null,
    }));
  }, [options.onBlockCreate]);

  const handleElementExtract = useCallback((elementId: string, targetBlockId: string, position: 'before' | 'after') => {
    console.log('🔄 [useDragAndDrop] ===== HANDLE ELEMENT EXTRACT =====');
    console.log('🔄 [useDragAndDrop] Element extract called:', { 
      elementId, 
      targetBlockId, 
      position,
      hasCallback: !!options.onBlockCreate
    });
    
    if (options.onBlockCreate) {
      console.log('🔄 [useDragAndDrop] Calling onBlockCreate callback...');
      options.onBlockCreate(elementId, targetBlockId);
      console.log('✅ [useDragAndDrop] onBlockCreate callback called successfully');
    } else {
      console.error('❌ [useDragAndDrop] onBlockCreate callback is not defined!');
    }
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedElementId: null,
      dropTarget: null,
      dropPosition: null,
    }));
    
    console.log('✅ [useDragAndDrop] ===== HANDLE ELEMENT EXTRACT COMPLETED =====');
  }, [options.onBlockCreate]);

  const handleElementDropBetweenBlocks = useCallback((
    sourceElementId: string,
    sourceBlockId: string,
    afterBlockId: string,
    beforeBlockId?: string
  ) => {
    console.log('[useDragAndDrop] handleElementDropBetweenBlocks called:', { 
      sourceElementId, 
      sourceBlockId, 
      afterBlockId, 
      beforeBlockId 
    });
    
    // Вызываем callback для создания нового блока между существующими
    options.onElementDropBetweenBlocks?.(sourceElementId, sourceBlockId, afterBlockId, beforeBlockId);
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      draggedElementId: null,
      dropTarget: null,
      dropPosition: null,
    }));
  }, [options.onElementDropBetweenBlocks]);

  const updateDropTarget = useCallback((targetId: string, position: 'before' | 'after' | 'inside') => {
    setState(prev => ({
      ...prev,
      dropTarget: targetId,
      dropPosition: position,
    }));
  }, []);

  const clearDropTarget = useCallback(() => {
    setState(prev => ({
      ...prev,
      dropTarget: null,
      dropPosition: null,
    }));
  }, []);

  return {
    state,
    handlers: {
      handleBlockDragStart,
      handleBlockDragEnd,
      handleElementDragStart,
      handleElementDragEnd,
      handleBlockDrop,
      handleElementDrop,
      handleBlockCreate,
      handleElementExtract,
      handleElementDropBetweenBlocks,
      updateDropTarget,
      clearDropTarget,
    }
  };
};
