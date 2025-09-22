import { useState, useCallback, useRef } from 'react';

export interface EnhancedDragAndDropState {
  isDragging: boolean;
  dragType: 'block' | 'element' | null;
  dragData: any;
  dropTarget: {
    type: 'block' | 'element' | 'inlineElement';
    position: 'before' | 'after' | 'inside';
    isValid: boolean;
    message?: string;
  } | null;
  dragOverPosition: 'before' | 'after' | 'inside' | null;
}

export interface EnhancedDragAndDropHandlers {
  handleBlockDragStart: (blockId: string, event: React.DragEvent) => void;
  handleBlockDragEnd: (blockId: string, event: React.DragEvent) => void;
  handleElementDragStart: (elementId: string, blockId: string, event: React.DragEvent) => void;
  handleElementDragEnd: (elementId: string, blockId: string, event: React.DragEvent) => void;
  handleBlockDrop: (blockId: string, event: React.DragEvent) => void;
  handleElementDrop: (elementId: string, blockId: string, event: React.DragEvent) => void;
  handleElementMoveWithinBlock: (sourceId: string, targetId: string, position: 'before' | 'after', blockId: string) => void;
  handleDragOver: (event: React.DragEvent) => void;
  handleDragLeave: () => void;
}

export interface UseEnhancedDragAndDropOptions {
  onBlockMove?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onElementMove?: (sourceId: string, targetId: string, position: 'before' | 'after', sourceBlockId: string, targetBlockId: string) => void;
  onElementMoveWithinBlock?: (sourceId: string, targetId: string, position: 'before' | 'after', blockId: string) => void;
  validateDrop?: (dragData: any, targetData: any) => { isValid: boolean; message?: string };
}

export const useEnhancedDragAndDrop = (options: UseEnhancedDragAndDropOptions = {}): {
  state: EnhancedDragAndDropState;
  handlers: EnhancedDragAndDropHandlers;
} => {
  const {
    onBlockMove,
    onElementMove,
    onElementMoveWithinBlock,
    validateDrop
  } = options;

  const [state, setState] = useState<EnhancedDragAndDropState>({
    isDragging: false,
    dragType: null,
    dragData: null,
    dropTarget: null,
    dragOverPosition: null
  });

  const dragStateRef = useRef<{
    isDragging: boolean;
    dragType: 'block' | 'element' | null;
    dragData: any;
  }>({
    isDragging: false,
    dragType: null,
    dragData: null
  });

  const handleBlockDragStart = useCallback((blockId: string, event: React.DragEvent) => {
    console.log('🎯 [EnhancedDnD] Block drag start:', blockId);
    
    const dragData = {
      type: 'block',
      blockId,
      version: '2.0'
    };

    setState(prev => ({
      ...prev,
      isDragging: true,
      dragType: 'block',
      dragData
    }));

    dragStateRef.current = {
      isDragging: true,
      dragType: 'block',
      dragData
    };

    event.dataTransfer.setData('application/block', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleBlockDragEnd = useCallback((blockId: string, event: React.DragEvent) => {
    console.log('🏁 [EnhancedDnD] Block drag end:', blockId);
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      dragType: null,
      dragData: null,
      dropTarget: null,
      dragOverPosition: null
    }));

    dragStateRef.current = {
      isDragging: false,
      dragType: null,
      dragData: null
    };
  }, []);

  const handleElementDragStart = useCallback((elementId: string, blockId: string, event: React.DragEvent) => {
    console.log('🎯 [EnhancedDnD] Element drag start:', elementId, blockId);
    
    const dragData = {
      type: 'element',
      elementId,
      blockId,
      version: '2.0'
    };

    setState(prev => ({
      ...prev,
      isDragging: true,
      dragType: 'element',
      dragData
    }));

    dragStateRef.current = {
      isDragging: true,
      dragType: 'element',
      dragData
    };

    event.dataTransfer.setData('application/element', JSON.stringify(dragData));
    event.dataTransfer.setData('application/element-type', 'element');
    event.dataTransfer.setData('application/parent-block', blockId);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleElementDragEnd = useCallback((elementId: string, blockId: string, event: React.DragEvent) => {
    console.log('🏁 [EnhancedDnD] Element drag end:', elementId, blockId);
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      dragType: null,
      dragData: null,
      dropTarget: null,
      dragOverPosition: null
    }));

    dragStateRef.current = {
      isDragging: false,
      dragType: null,
      dragData: null
    };
  }, []);

  const handleBlockDrop = useCallback((blockId: string, event: React.DragEvent) => {
    console.log('🎯 [EnhancedDnD] Block drop:', blockId);
    
    event.preventDefault();
    event.stopPropagation();

    const blockData = event.dataTransfer.getData('application/block');
    if (!blockData) return;

    const dragData = JSON.parse(blockData);
    if (dragData.type !== 'block' || dragData.blockId === blockId) return;

    const position = state.dragOverPosition || 'after';
    
    if (onBlockMove && (position === 'before' || position === 'after')) {
      onBlockMove(dragData.blockId, blockId, position);
    }

    setState(prev => ({
      ...prev,
      dropTarget: null,
      dragOverPosition: null
    }));
  }, [state.dragOverPosition, onBlockMove]);

  const handleElementDrop = useCallback((elementId: string, blockId: string, event: React.DragEvent) => {
    console.log('🎯 [EnhancedDnD] Element drop:', elementId, blockId);
    
    event.preventDefault();
    event.stopPropagation();

    const elementData = event.dataTransfer.getData('application/element');
    if (!elementData) return;

    const dragData = JSON.parse(elementData);
    if (dragData.type !== 'element' || dragData.elementId === elementId) return;

    const position = state.dragOverPosition || 'after';
    
    if (onElementMove && (position === 'before' || position === 'after')) {
      onElementMove(
        dragData.elementId,
        elementId,
        position,
        dragData.blockId,
        blockId
      );
    }

    setState(prev => ({
      ...prev,
      dropTarget: null,
      dragOverPosition: null
    }));
  }, [state.dragOverPosition, onElementMove]);

  const handleElementMoveWithinBlock = useCallback((sourceId: string, targetId: string, position: 'before' | 'after', blockId: string) => {
    console.log('🎯 [EnhancedDnD] Element move within block:', sourceId, targetId, position, blockId);
    
    if (onElementMoveWithinBlock) {
      onElementMoveWithinBlock(sourceId, targetId, position, blockId);
    }
  }, [onElementMoveWithinBlock]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!dragStateRef.current.isDragging) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Determine drop position based on mouse position
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    const height = rect.height;
    
    let position: 'before' | 'after' | 'inside' = 'after';
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'inside';
    }

    setState(prev => ({
      ...prev,
      dragOverPosition: position
    }));

    // Validate drop if validator provided
    if (validateDrop) {
      const validation = validateDrop(dragStateRef.current.dragData, {
        type: dragStateRef.current.dragType,
        position
      });
      
      setState(prev => ({
        ...prev,
        dropTarget: {
          type: dragStateRef.current.dragType === 'block' ? 'block' : 'element',
          position,
          isValid: validation.isValid,
          message: validation.message
        }
      }));
    }
  }, [validateDrop]);

  const handleDragLeave = useCallback(() => {
    setState(prev => ({
      ...prev,
      dropTarget: null,
      dragOverPosition: null
    }));
  }, []);

  const handlers: EnhancedDragAndDropHandlers = {
    handleBlockDragStart,
    handleBlockDragEnd,
    handleElementDragStart,
    handleElementDragEnd,
    handleBlockDrop,
    handleElementDrop,
    handleElementMoveWithinBlock,
    handleDragOver,
    handleDragLeave
  };

  return {
    state,
    handlers
  };
};
