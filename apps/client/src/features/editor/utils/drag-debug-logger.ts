/**
 * Централизованная система логирования для drag-and-drop операций
 * Собирает всю информацию о drag операциях и выводит её одним блоком
 */

export interface DragDebugInfo {
  operationId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // Drag Start Info
  dragStart?: {
    element: HTMLElement | null;
    elementId: string | null;
    blockId: string | null;
    dragType: 'block' | 'element' | null;
    dataTransfer: {
      types: string[];
      effectAllowed: string;
      files: FileList | null;
    };
    mousePosition: { x: number; y: number };
    targetElement: HTMLElement | null;
  };
  
  // Drag Over Events
  dragOverEvents: Array<{
    timestamp: number;
    target: HTMLElement | null;
    targetId: string | null;
    position: 'before' | 'after' | 'inside' | null;
    mousePosition: { x: number; y: number };
    dataTransfer: {
      dropEffect: string;
      types: string[];
    };
  }>;
  
  // Drop Event
  drop?: {
    target: HTMLElement | null;
    targetId: string | null;
    position: 'before' | 'after' | 'inside' | null;
    mousePosition: { x: number; y: number };
    dataTransfer: {
      dropEffect: string;
      types: string[];
      data: { [key: string]: string };
    };
    success: boolean;
    error?: string;
  };
  
  // Drag End
  dragEnd?: {
    success: boolean;
    dropEffect: string;
    effectAllowed: string;
    cleanupPerformed: boolean;
  };
  
  // System State
  systemState: {
    dragHandlesFound: number;
    dropZonesFound: number;
    eventListenersActive: boolean;
    unifiedHandlersLoaded: boolean;
  };
}

class DragDebugLogger {
  private currentOperation: DragDebugInfo | null = null;
  private operationCounter = 0;
  
  startOperation(): string {
    this.operationCounter++;
    const operationId = `drag-op-${this.operationCounter}-${Date.now()}`;
    
    this.currentOperation = {
      operationId,
      startTime: Date.now(),
      dragOverEvents: [],
      systemState: {
        dragHandlesFound: this.countDragHandles(),
        dropZonesFound: this.countDropZones(),
        eventListenersActive: this.checkEventListeners(),
        unifiedHandlersLoaded: this.checkUnifiedHandlers()
      }
    };
    
    console.log(`🎯 [DragDebug] Starting operation: ${operationId}`);
    return operationId;
  }
  
  logDragStart(
    element: HTMLElement | null,
    elementId: string | null,
    blockId: string | null,
    dragType: 'block' | 'element' | null,
    dataTransfer: DataTransfer,
    mousePosition: { x: number; y: number },
    targetElement: HTMLElement | null
  ) {
    if (!this.currentOperation) return;
    
    this.currentOperation.dragStart = {
      element,
      elementId,
      blockId,
      dragType,
      dataTransfer: {
        types: Array.from(dataTransfer.types),
        effectAllowed: dataTransfer.effectAllowed,
        files: dataTransfer.files
      },
      mousePosition,
      targetElement
    };
    
    console.log(`🎯 [DragDebug] Drag start logged for operation: ${this.currentOperation.operationId}`);
  }
  
  logDragOver(
    target: HTMLElement | null,
    targetId: string | null,
    position: 'before' | 'after' | 'inside' | null,
    mousePosition: { x: number; y: number },
    dataTransfer: DataTransfer
  ) {
    if (!this.currentOperation) return;
    
    // Ограничиваем количество dragOver событий для производительности
    if (this.currentOperation.dragOverEvents.length > 50) return;
    
    this.currentOperation.dragOverEvents.push({
      timestamp: Date.now(),
      target,
      targetId,
      position,
      mousePosition,
      dataTransfer: {
        dropEffect: dataTransfer.dropEffect,
        types: Array.from(dataTransfer.types)
      }
    });
  }
  
  logDrop(
    target: HTMLElement | null,
    targetId: string | null,
    position: 'before' | 'after' | 'inside' | null,
    mousePosition: { x: number; y: number },
    dataTransfer: DataTransfer,
    success: boolean,
    error?: string
  ) {
    if (!this.currentOperation) return;
    
    const data: { [key: string]: string } = {};
    for (const type of dataTransfer.types) {
      try {
        data[type] = dataTransfer.getData(type);
      } catch (e) {
        data[type] = `Error reading data: ${e}`;
      }
    }
    
    this.currentOperation.drop = {
      target,
      targetId,
      position,
      mousePosition,
      dataTransfer: {
        dropEffect: dataTransfer.dropEffect,
        types: Array.from(dataTransfer.types),
        data
      },
      success,
      error
    };
    
    console.log(`🎯 [DragDebug] Drop logged for operation: ${this.currentOperation.operationId}`);
  }
  
  logDragEnd(
    success: boolean,
    dropEffect: string,
    effectAllowed: string,
    cleanupPerformed: boolean
  ) {
    if (!this.currentOperation) return;
    
    this.currentOperation.dragEnd = {
      success,
      dropEffect,
      effectAllowed,
      cleanupPerformed
    };
    
    this.currentOperation.endTime = Date.now();
    this.currentOperation.duration = this.currentOperation.endTime - this.currentOperation.startTime;
    
    this.outputCompleteLog();
    this.currentOperation = null;
  }
  
  private outputCompleteLog() {
    if (!this.currentOperation) return;
    
    console.group(`🎯 [DragDebug] COMPLETE OPERATION REPORT: ${this.currentOperation.operationId}`);
    console.log('📊 Operation Summary:', {
      duration: `${this.currentOperation.duration}ms`,
      success: this.currentOperation.drop?.success || false,
      dragType: this.currentOperation.dragStart?.dragType,
      dragOverEvents: this.currentOperation.dragOverEvents.length
    });
    
    console.log('🚀 Drag Start:', this.currentOperation.dragStart);
    console.log('🔄 Drag Over Events:', this.currentOperation.dragOverEvents);
    console.log('🎯 Drop Event:', this.currentOperation.drop);
    console.log('🏁 Drag End:', this.currentOperation.dragEnd);
    console.log('⚙️ System State:', this.currentOperation.systemState);
    
    // Анализ проблем
    this.analyzeProblems();
    
    console.groupEnd();
  }
  
  private analyzeProblems() {
    if (!this.currentOperation) return;
    
    const problems: string[] = [];
    
    // Проверяем drag start
    if (!this.currentOperation.dragStart) {
      problems.push('❌ Drag start не был зарегистрирован');
    }
    
    // Проверяем drop
    if (!this.currentOperation.drop) {
      problems.push('❌ Drop событие не было зарегистрировано');
    } else if (!this.currentOperation.drop.success) {
      problems.push(`❌ Drop не удался: ${this.currentOperation.drop.error || 'Неизвестная ошибка'}`);
    }
    
    // Проверяем drag over события
    if (this.currentOperation.dragOverEvents.length === 0) {
      problems.push('❌ Нет drag over событий - возможно проблема с event listeners');
    }
    
    // Проверяем систему
    if (this.currentOperation.systemState.dragHandlesFound === 0) {
      problems.push('❌ Не найдено drag handle элементов');
    }
    
    if (this.currentOperation.systemState.dropZonesFound === 0) {
      problems.push('❌ Не найдено drop zone элементов');
    }
    
    if (!this.currentOperation.systemState.eventListenersActive) {
      problems.push('❌ Event listeners не активны');
    }
    
    if (!this.currentOperation.systemState.unifiedHandlersLoaded) {
      problems.push('❌ Unified handlers не загружены');
    }
    
    if (problems.length > 0) {
      console.warn('🚨 ПРОБЛЕМЫ ОБНАРУЖЕНЫ:');
      problems.forEach(problem => console.warn(problem));
    } else {
      console.log('✅ Проблем не обнаружено');
    }
  }
  
  private countDragHandles(): number {
    return document.querySelectorAll('[draggable="true"]').length;
  }
  
  private countDropZones(): number {
    return document.querySelectorAll('[data-drop-zone="true"]').length;
  }
  
  private checkEventListeners(): boolean {
    // Проверяем, есть ли активные event listeners
    const testElement = document.createElement('div');
    let hasListeners = false;
    
    try {
      const originalAddEventListener = testElement.addEventListener;
      testElement.addEventListener = function(type, listener, options) {
        hasListeners = true;
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // Триггерим проверку
      testElement.dispatchEvent(new Event('test'));
    } catch (e) {
      // Игнорируем ошибки
    }
    
    return hasListeners;
  }
  
  private checkUnifiedHandlers(): boolean {
    // Проверяем, загружены ли unified handlers
    return typeof window !== 'undefined' && 
           'handleUnifiedDragStart' in window && 
           'handleUnifiedDragOver' in window && 
           'handleUnifiedDrop' in window;
  }
}

// Создаем глобальный экземпляр
export const dragDebugLogger = new DragDebugLogger();

// Добавляем в window для глобального доступа
if (typeof window !== 'undefined') {
  (window as any).dragDebugLogger = dragDebugLogger;
}