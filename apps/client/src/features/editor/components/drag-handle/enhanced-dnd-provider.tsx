import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EditorView } from 'prosemirror-view';
import { dndCoordinator } from '../../dnd/DndCoordinator';
import { UnifiedDragData } from '../../types/drag-types';
import { cleanupDragState, clearDragOverCache } from '../../utils/unified-drag-handlers';

interface DndContextType {
  registerElement: (elementId: string, blockId: string, ref: React.RefObject<HTMLElement>) => void;
  unregisterElement: (elementId: string) => void;
  registerBlock: (blockId: string, ref: React.RefObject<HTMLElement>) => void;
  unregisterBlock: (blockId: string) => void;
  handleElementMove: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  handleBlockMove: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
}

const DndContext = createContext<DndContextType | undefined>(undefined);

export const useDndContext = () => {
  const context = useContext(DndContext);
  if (!context) {
    throw new Error('useDndContext must be used within a EnhancedDndProvider');
  }
  return context;
};

interface EnhancedDndProviderProps {
  children: React.ReactNode;
  view?: EditorView;
}

export const EnhancedDndProvider: React.FC<EnhancedDndProviderProps> = ({ children, view }) => {
  const [elements, setElements] = useState<Map<string, { blockId: string; ref: React.RefObject<HTMLElement> }>>(new Map());
  const [blocks, setBlocks] = useState<Map<string, React.RefObject<HTMLElement>>>(new Map());

  const registerElement = useCallback((elementId: string, blockId: string, ref: React.RefObject<HTMLElement>) => {
    setElements(prev => {
      const newMap = new Map(prev);
      newMap.set(elementId, { blockId, ref });
      return newMap;
    });
  }, []);

  const unregisterElement = useCallback((elementId: string) => {
    setElements(prev => {
      const newMap = new Map(prev);
      newMap.delete(elementId);
      return newMap;
    });
  }, []);

  const registerBlock = useCallback((blockId: string, ref: React.RefObject<HTMLElement>) => {
    setBlocks(prev => {
      const newMap = new Map(prev);
      newMap.set(blockId, ref);
      return newMap;
    });
  }, []);

  const unregisterBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      const newMap = new Map(prev);
      newMap.delete(blockId);
      return newMap;
    });
  }, []);

  const handleElementMove = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
    console.log('🔄 [EnhancedDndProvider] ===== ELEMENT MOVE =====');
    console.log('🔄 [EnhancedDndProvider] Source ID:', sourceId);
    console.log('🔄 [EnhancedDndProvider] Target ID:', targetId);
    console.log('🔄 [EnhancedDndProvider] Position:', position);

    if (view) {
      try {
        // Здесь должна быть логика перемещения элемента в редакторе
        console.log('🔄 [EnhancedDndProvider] Moving element in editor...');

        // TODO: Реализовать правильную логику поиска позиций по ID
        console.log('🔄 [EnhancedDndProvider] Element move logic needs implementation');
        console.log('🔄 [EnhancedDndProvider] Source ID:', sourceId);
        console.log('🔄 [EnhancedDndProvider] Target ID:', targetId);
        console.log('🔄 [EnhancedDndProvider] Position:', position);
      } catch (error) {
        console.error('❌ [EnhancedDndProvider] Error moving element:', error);
      }
    }
  }, [view]);

  const handleBlockMove = useCallback((sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    console.log('🔄 [EnhancedDndProvider] ===== BLOCK MOVE =====');
    console.log('🔄 [EnhancedDndProvider] Source ID:', sourceId);
    console.log('🔄 [EnhancedDndProvider] Target ID:', targetId);
    console.log('🔄 [EnhancedDndProvider] Position:', position);

    if (view) {
      try {
        // Здесь должна быть логика перемещения блока в редакторе
        console.log('🔄 [EnhancedDndProvider] Moving block in editor...');

        // TODO: Реализовать правильную логику поиска позиций по ID
        console.log('🔄 [EnhancedDndProvider] Block move logic needs implementation');
        console.log('🔄 [EnhancedDndProvider] Source ID:', sourceId);
        console.log('🔄 [EnhancedDndProvider] Target ID:', targetId);
        console.log('🔄 [EnhancedDndProvider] Position:', position);
      } catch (error) {
        console.error('❌ [EnhancedDndProvider] Error moving block:', error);
      }
    }
  }, [view]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      console.log('🧹 [EnhancedDndProvider] Component unmounting, clearing drag state...');
      cleanupDragState();
      clearDragOverCache();
    };
  }, []);

  const contextValue = {
    registerElement,
    unregisterElement,
    registerBlock,
    unregisterBlock,
    handleElementMove,
    handleBlockMove,
  };

  return (
    <DndContext.Provider value={contextValue}>
      {children}
    </DndContext.Provider>
  );
};
