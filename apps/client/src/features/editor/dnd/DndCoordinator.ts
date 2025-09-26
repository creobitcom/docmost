/**
 * Координатор для drag-and-drop операций
 */

export interface DndPayload {
  type: 'element' | 'block';
  sourceId: string;
  sourceBlockId: string;
  targetId?: string;
  targetBlockId?: string;
  position?: 'before' | 'after' | 'inside';
  synthetic?: boolean;
  textContent?: string;
  payload?: any;
  meta?: any;
  blockId?: string;
  elementId?: string;
}

class DndCoordinatorClass {
  private listeners: Map<string, (payload: DndPayload) => void> = new Map();
  private currentState: any = null;
  private currentBlockId: string | null = null;

  register(id: string, callback: (payload: DndPayload) => void): void {
    this.listeners.set(id, callback);
    console.log('🎯 [DndCoordinator] Registered listener for:', id);
  }

  unregister(id: string): void {
    this.listeners.delete(id);
    console.log('🎯 [DndCoordinator] Unregistered listener for:', id);
  }

  dispatch(payload: DndPayload): void {
    console.log('🎯 [DndCoordinator] Dispatching payload:', payload);
    
    this.listeners.forEach((callback, id) => {
      try {
        callback(payload);
        console.log('✅ [DndCoordinator] Listener executed for:', id);
      } catch (error) {
        console.error('❌ [DndCoordinator] Error in listener for', id, ':', error);
      }
    });
  }

  start(payload: DndPayload): void {
    this.currentState = payload;
    console.log('🎯 [DndCoordinator] Started drag operation:', payload);
  }

  end(): void {
    this.currentState = null;
    this.currentBlockId = null;
    console.log('🎯 [DndCoordinator] Ended drag operation');
  }

  getState(): any {
    return this.currentState;
  }

  getCurrentPayload(): any {
    return this.currentState;
  }

  getBlockId(): string | null {
    return this.currentBlockId;
  }

  isElementDrag(): boolean {
    return this.currentState?.type === 'element';
  }

  forceCleanup(): void {
    this.currentState = null;
    this.currentBlockId = null;
    console.log('🎯 [DndCoordinator] Force cleanup completed');
  }
}

export const dndCoordinator = new DndCoordinatorClass();

// Добавляем в window для тестирования
if (typeof window !== 'undefined') {
  (window as any).dndCoordinator = dndCoordinator;
}
