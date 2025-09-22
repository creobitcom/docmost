import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { EditorView } from 'prosemirror-view';
import { dndCoordinator, DndPayload } from '../../dnd/DndCoordinator';

interface DndContextType {
  registerElement: (elementId: string, blockId: string, callback: (payload: DndPayload) => void) => void;
  unregisterElement: (elementId: string) => void;
  registerBlock: (blockId: string, callback: (payload: DndPayload) => void) => void;
  unregisterBlock: (blockId: string) => void;
  handleElementMove: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  handleBlockMove: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
}

const DndContext = createContext<DndContextType | null>(null);

interface EnhancedDndProviderV2Props {
  children: React.ReactNode;
  view?: EditorView;
}

export const EnhancedDndProviderV2: React.FC<EnhancedDndProviderV2Props> = ({
  children,
  view,
}) => {
  const elementCallbacks = useRef<Map<string, (payload: DndPayload) => void>>(new Map());
  const blockCallbacks = useRef<Map<string, (payload: DndPayload) => void>>(new Map());

  const registerElement = useCallback((elementId: string, blockId: string, callback: (payload: DndPayload) => void) => {
    const key = `${elementId}-${blockId}`;
    elementCallbacks.current.set(key, callback);
    dndCoordinator.register(key, callback);
    console.log('🎯 [EnhancedDndProviderV2] Registered element:', key);
  }, []);

  const unregisterElement = useCallback((elementId: string) => {
    const keysToRemove: string[] = [];
    elementCallbacks.current.forEach((_, key) => {
      if (key.startsWith(`${elementId}-`)) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      elementCallbacks.current.delete(key);
      dndCoordinator.unregister(key);
      console.log('🎯 [EnhancedDndProviderV2] Unregistered element:', key);
    });
  }, []);

  const registerBlock = useCallback((blockId: string, callback: (payload: DndPayload) => void) => {
    blockCallbacks.current.set(blockId, callback);
    dndCoordinator.register(blockId, callback);
    console.log('🎯 [EnhancedDndProviderV2] Registered block:', blockId);
  }, []);

  const unregisterBlock = useCallback((blockId: string) => {
    blockCallbacks.current.delete(blockId);
    dndCoordinator.unregister(blockId);
    console.log('🎯 [EnhancedDndProviderV2] Unregistered block:', blockId);
  }, []);

  const handleElementMove = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
    console.log('🔄 [EnhancedDndProviderV2] ===== ELEMENT MOVE =====');
    console.log('🔄 [EnhancedDndProviderV2] Source ID:', sourceId);
    console.log('🔄 [EnhancedDndProviderV2] Target ID:', targetId);
    console.log('🔄 [EnhancedDndProviderV2] Position:', position);

    if (view) {
      try {
        // Здесь должна быть логика перемещения элемента в редакторе
        console.log('🔄 [EnhancedDndProviderV2] Moving element in editor...');
        
        // TODO: Реализовать правильную логику поиска позиций по ID
        console.log('🔄 [EnhancedDndProviderV2] Element move logic needs implementation');
        console.log('🔄 [EnhancedDndProviderV2] Source ID:', sourceId);
        console.log('🔄 [EnhancedDndProviderV2] Target ID:', targetId);
        console.log('🔄 [EnhancedDndProviderV2] Position:', position);
      } catch (error) {
        console.error('❌ [EnhancedDndProviderV2] Error moving element:', error);
      }
    }
  }, [view]);

  const handleBlockMove = useCallback((sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    console.log('🔄 [EnhancedDndProviderV2] ===== BLOCK MOVE =====');
    console.log('🔄 [EnhancedDndProviderV2] Source ID:', sourceId);
    console.log('🔄 [EnhancedDndProviderV2] Target ID:', targetId);
    console.log('🔄 [EnhancedDndProviderV2] Position:', position);

    if (view) {
      try {
        // Здесь должна быть логика перемещения блока в редакторе
        console.log('🔄 [EnhancedDndProviderV2] Moving block in editor...');
        
        // TODO: Реализовать правильную логику поиска позиций по ID
        console.log('🔄 [EnhancedDndProviderV2] Block move logic needs implementation');
        console.log('🔄 [EnhancedDndProviderV2] Source ID:', sourceId);
        console.log('🔄 [EnhancedDndProviderV2] Target ID:', targetId);
        console.log('🔄 [EnhancedDndProviderV2] Position:', position);
      } catch (error) {
        console.error('❌ [EnhancedDndProviderV2] Error moving block:', error);
      }
    }
  }, [view]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      elementCallbacks.current.clear();
      blockCallbacks.current.clear();
      console.log('🧹 [EnhancedDndProviderV2] Cleaned up all callbacks');
    };
  }, []);

  const contextValue: DndContextType = {
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

export const useDndContext = (): DndContextType => {
  const context = useContext(DndContext);
  if (!context) {
    throw new Error('useDndContext must be used within an EnhancedDndProviderV2');
  }
  return context;
};
