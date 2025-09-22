import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { DropIndicators } from './drop-indicators';

export interface DnDState {
  isDragging: boolean;
  dragType: 'block' | 'element' | null;
  dragData: any;
  dropTarget: {
    type: 'block' | 'element' | 'inlineElement';
    position: 'before' | 'after' | 'inside';
    isValid: boolean;
    message?: string;
  } | null;
}

export interface DnDContextType {
  state: DnDState;
  setDragState: (isDragging: boolean, dragType: 'block' | 'element' | null, dragData?: any) => void;
  setDropTarget: (target: DnDState['dropTarget']) => void;
  clearDropTarget: () => void;
  onBlockMove: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onElementMove: (sourceId: string, targetId: string, position: 'before' | 'after', sourceBlockId: string, targetBlockId: string) => void;
}

const DnDContext = createContext<DnDContextType | null>(null);

export const useDnD = () => {
  const context = useContext(DnDContext);
  if (!context) {
    throw new Error('useDnD must be used within a DnDProvider');
  }
  return context;
};

export interface DnDProviderProps {
  children: React.ReactNode;
  onBlockMove?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onElementMove?: (sourceId: string, targetId: string, position: 'before' | 'after', sourceBlockId: string, targetBlockId: string) => void;
}

export const DnDProvider: React.FC<DnDProviderProps> = ({
  children,
  onBlockMove,
  onElementMove
}) => {
  const [state, setState] = useState<DnDState>({
    isDragging: false,
    dragType: null,
    dragData: null,
    dropTarget: null
  });

  const setDragState = useCallback((isDragging: boolean, dragType: 'block' | 'element' | null, dragData?: any) => {
    setState(prev => ({
      ...prev,
      isDragging,
      dragType,
      dragData: isDragging ? dragData : null
    }));
  }, []);

  const setDropTarget = useCallback((target: DnDState['dropTarget']) => {
    setState(prev => ({
      ...prev,
      dropTarget: target
    }));
  }, []);

  const clearDropTarget = useCallback(() => {
    setState(prev => ({
      ...prev,
      dropTarget: null
    }));
  }, []);

  const handleBlockMove = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
    if (onBlockMove) {
      onBlockMove(sourceId, targetId, position);
    }
  }, [onBlockMove]);

  const handleElementMove = useCallback((sourceId: string, targetId: string, position: 'before' | 'after', sourceBlockId: string, targetBlockId: string) => {
    if (onElementMove) {
      onElementMove(sourceId, targetId, position, sourceBlockId, targetBlockId);
    }
  }, [onElementMove]);

  const contextValue: DnDContextType = {
    state,
    setDragState,
    setDropTarget,
    clearDropTarget,
    onBlockMove: handleBlockMove,
    onElementMove: handleElementMove
  };

  return (
    <DnDContext.Provider value={contextValue}>
      {children}
      {state.dropTarget && (
        <DropIndicators
          type={state.dropTarget.type}
          position={state.dropTarget.position}
          isValid={state.dropTarget.isValid}
          message={state.dropTarget.message}
        />
      )}
    </DnDContext.Provider>
  );
};


