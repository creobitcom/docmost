export interface DragState {
  version: string;
  type: 'block' | 'element';
  blockId: string;
  elementId?: string;
  sourceHandle?: string;
  timestamp: number;
}

class DragStateManagerClass {
  private state: DragState | null = null;

  set(state: DragState): void {
    console.log('[DragStateManager] Setting drag state:', state);
    this.state = state;
  }

  get(): DragState | null {
    return this.state;
  }

  clear(): void {
    console.log('[DragStateManager] Clearing drag state');
    this.state = null;
  }

  isActive(): boolean {
    return this.state !== null;
  }

  getType(): 'block' | 'element' | null {
    return this.state?.type || null;
  }

  getBlockId(): string | null {
    return this.state?.blockId || null;
  }

  getElementId(): string | null {
    return this.state?.elementId || null;
  }

  hasValid(): boolean {
    return this.state !== null && this.state.timestamp > 0;
  }
}

export const DragStateManager = new DragStateManagerClass();