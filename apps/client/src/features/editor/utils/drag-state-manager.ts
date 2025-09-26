export interface DragState {
  version: string;
  type: 'block' | 'element';
  blockId: string;
  elementId?: string;
  sourceHandle?: 'element' | 'global';
  timestamp: number;
}

class DragStateManagerClass {
  private state: DragState | null = null;
  private fallbackRecoveryCount = 0;
  private lastRecoveryTime = 0;

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
    this.fallbackRecoveryCount = 0;
    this.lastRecoveryTime = 0;
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

  /**
   * Восстанавливает состояние из fallback источника
   */
  restoreFromFallback(fallbackData: DragState, source: string): boolean {
    try {
      // Валидируем данные перед восстановлением
      if (!this.validateDragState(fallbackData)) {
        console.warn('[DragStateManager] Invalid fallback data received from:', source);
        return false;
      }

      this.state = fallbackData;
      this.fallbackRecoveryCount++;
      this.lastRecoveryTime = Date.now();

      console.log('[DragStateManager] State restored from fallback:', {
        source,
        type: fallbackData.type,
        blockId: fallbackData.blockId,
        elementId: fallbackData.elementId,
        recoveryCount: this.fallbackRecoveryCount
      });

      return true;
    } catch (error) {
      console.error('[DragStateManager] Error restoring from fallback:', error);
      return false;
    }
  }

  /**
   * Валидирует drag состояние
   */
  private validateDragState(state: DragState): boolean {
    if (!state) return false;
    if (!state.version || !state.type || !state.blockId || !state.timestamp) return false;
    if (state.type !== 'block' && state.type !== 'element') return false;
    if (state.type === 'element' && !state.elementId) return false;
    if (state.timestamp <= 0) return false;
    
    return true;
  }

  /**
   * Получает статистику fallback восстановлений
   */
  getRecoveryStats(): { count: number; lastTime: number; isRecent: boolean } {
    const now = Date.now();
    const isRecent = (now - this.lastRecoveryTime) < 5000; // 5 секунд
    
    return {
      count: this.fallbackRecoveryCount,
      lastTime: this.lastRecoveryTime,
      isRecent
    };
  }

  /**
   * Проверяет, нужна ли очистка состояния из-за частых fallback восстановлений
   */
  shouldForceCleanup(): boolean {
    const stats = this.getRecoveryStats();
    return stats.count > 3 && stats.isRecent;
  }
}

export const DragStateManager = new DragStateManagerClass();

// Добавляем в window для тестирования
if (typeof window !== 'undefined') {
  (window as any).DragStateManager = DragStateManager;
}