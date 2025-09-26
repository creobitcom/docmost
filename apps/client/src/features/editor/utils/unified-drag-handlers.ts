/**
 * Универсальные обработчики drag-and-drop для блоков и элементов
 */

import { UnifiedDragData, ElementData } from '../types/drag-types';
import { DragStateManager } from './drag-state-manager';
import { autoFixDuplicateElementIds } from './fix-duplicate-element-ids';
import { logFallbackTest, TestResult } from './dnd-test-logger';

// Глобальный кэш для предотвращения повторных dragover событий
let lastDragOverState: {
  targetElementId?: string;
  targetBlockId?: string;
  clientX: number;
  clientY: number;
  timestamp: number;
} | null = null;

/**
 * Улучшенный поиск элемента с data-element-id
 */
function findTargetElement(target: HTMLElement): HTMLElement | null {
  // Сначала проверяем сам элемент
  if (target.hasAttribute('data-element-id')) {
    return target;
  }

  // Затем ищем среди родителей
  let current = target.parentElement;
  while (current) {
    if (current.hasAttribute('data-element-id')) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Проверяет, является ли текущее dragover событие дубликатом предыдущего
 */
function isDuplicateDragOver(e: DragEvent, targetElementId?: string, targetBlockId?: string): boolean {
  const now = Date.now();
  const threshold = 16; // ~60fps

  if (!lastDragOverState) {
    return false;
  }

  // Проверяем временной интервал
  if (now - lastDragOverState.timestamp < threshold) {
    return true;
  }

  // Проверяем, изменились ли координаты
  const deltaX = Math.abs(e.clientX - lastDragOverState.clientX);
  const deltaY = Math.abs(e.clientY - lastDragOverState.clientY);
  if (deltaX < 5 && deltaY < 5) {
    return true;
  }

  // Проверяем, изменились ли цели
  if (targetElementId === lastDragOverState.targetElementId &&
      targetBlockId === lastDragOverState.targetBlockId) {
    return true;
  }

  return false;
}

/**
 * Обновляет кэш последнего dragover состояния
 */
function updateDragOverCache(e: DragEvent, targetElementId?: string, targetBlockId?: string): void {
  lastDragOverState = {
    targetElementId,
    targetBlockId,
    clientX: e.clientX,
    clientY: e.clientY,
    timestamp: Date.now()
  };
}

/**
 * Очищает кэш dragover состояния (вызывается при завершении drag операции)
 */
export function clearDragOverCache(): void {
  lastDragOverState = null;
}

/**
 * Универсальный обработчик drag start
 */
export async function handleUnifiedDragStart(e: DragEvent): Promise<UnifiedDragData | null> {
  console.log('🎯 [UnifiedDragHandlers] ===== UNIFIED DRAG START =====');
  console.log('🎯 [UnifiedDragHandlers] Event type:', e.type);
  console.log('🎯 [UnifiedDragHandlers] Event target:', e.target);
  console.log('🎯 [UnifiedDragHandlers] Event currentTarget:', e.currentTarget);
  console.log('🎯 [UnifiedDragHandlers] Event bubbles:', e.bubbles);
  console.log('🎯 [UnifiedDragHandlers] Event cancelable:', e.cancelable);
  console.log('🎯 [UnifiedDragHandlers] DataTransfer types:', e.dataTransfer?.types);
  console.log('🎯 [UnifiedDragHandlers] DataTransfer effectAllowed:', e.dataTransfer?.effectAllowed);
  
  // 🔧 ИСПРАВЛЕНИЕ: Автоматически исправляем дублирующиеся elementId перед началом drag
  console.log('🔧 [UnifiedDragHandlers] Auto-fixing duplicate element IDs before drag start...');
  autoFixDuplicateElementIds();
  console.log('✅ [UnifiedDragHandlers] Duplicate element ID fixing completed');

  const target = e.target as HTMLElement;
  console.log('🎯 [UnifiedDragHandlers] Target element:', target);
  console.log('🎯 [UnifiedDragHandlers] Target classes:', target.className);
  console.log('🎯 [UnifiedDragHandlers] Target attributes:', Array.from(target.attributes).map(attr => `${attr.name}="${attr.value}"`));
  console.log('🎯 [UnifiedDragHandlers] Target tagName:', target.tagName);
  console.log('🎯 [UnifiedDragHandlers] Target id:', target.id);

  try {
    // 1. Элемент списка
    console.log('🎯 [UnifiedDragHandlers] Checking for element drag handle...');
    const elementHandle = target.closest('[data-element-drag-handle="true"]');
    if (elementHandle) {
      console.log('✅ [UnifiedDragHandlers] Element drag handle detected');
      console.log('🎯 [UnifiedDragHandlers] Element handle element:', elementHandle);

      const element = target.closest('[data-element-id]');
      const block = target.closest('[data-block-id]');

      console.log('🎯 [UnifiedDragHandlers] Found element:', element);
      console.log('🎯 [UnifiedDragHandlers] Found block:', block);
      console.log('🎯 [UnifiedDragHandlers] Element elementId:', element?.getAttribute('data-element-id'));
      console.log('🎯 [UnifiedDragHandlers] Block blockId:', block?.getAttribute('data-block-id'));

      if (!element || !block) {
        console.error('❌ [UnifiedDragHandlers] Element or block not found for element drag');
        console.error('❌ [UnifiedDragHandlers] Element found:', !!element);
        console.error('❌ [UnifiedDragHandlers] Block found:', !!block);
        return null;
      }

      const dragData: UnifiedDragData = {
        version: '2.0',
        type: 'element',
        blockId: block.getAttribute('data-block-id')!,
        elementId: element.getAttribute('data-element-id')!,
        sourceHandle: 'element',
        timestamp: Date.now(),
      };

      console.log('✅ [UnifiedDragHandlers] Element drag data created:', dragData);

      // Сохраняем в безопасный менеджер состояния
      console.log('🎯 [UnifiedDragHandlers] Setting drag state in DragStateManager...');
      DragStateManager.set(dragData);
      console.log('✅ [UnifiedDragHandlers] Drag state set in DragStateManager');

      // Синхронизируем со всеми источниками
      await syncDragStateToAllSources(dragData);

      // Устанавливаем данные в DataTransfer
      console.log('🎯 [UnifiedDragHandlers] Setting DataTransfer data...');
      e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer!.effectAllowed = 'move';
      console.log('✅ [UnifiedDragHandlers] DataTransfer data set');
      console.log('✅ [UnifiedDragHandlers] DataTransfer effectAllowed set to:', e.dataTransfer?.effectAllowed);

      console.log('✅ [UnifiedDragHandlers] ===== ELEMENT DRAG START SUCCESS =====');
      return dragData;
    }

    // 2. Блок
    console.log('🎯 [UnifiedDragHandlers] Checking for block drag handle...');
    const blockHandle = target.closest('[data-global-drag-handle="true"]');
    if (blockHandle) {
      console.log('✅ [UnifiedDragHandlers] Block drag handle detected');
      console.log('🎯 [UnifiedDragHandlers] Block handle element:', blockHandle);

      const block = target.closest('[data-block-id]');

      console.log('🎯 [UnifiedDragHandlers] Found block for drag:', block);
      console.log('🎯 [UnifiedDragHandlers] Block blockId:', block?.getAttribute('data-block-id'));

      if (!block) {
        console.error('❌ [UnifiedDragHandlers] Block not found for block drag');
        return null;
      }

      const dragData: UnifiedDragData = {
        version: '2.0',
        type: 'block',
        blockId: block.getAttribute('data-block-id')!,
        sourceHandle: 'global',
        timestamp: Date.now(),
      };

      console.log('✅ [UnifiedDragHandlers] Block drag data created:', dragData);

      // Сохраняем в безопасный менеджер состояния
      console.log('🎯 [UnifiedDragHandlers] Setting drag state in DragStateManager...');
      DragStateManager.set(dragData);
      console.log('✅ [UnifiedDragHandlers] Drag state set in DragStateManager');

      // Синхронизируем со всеми источниками
      await syncDragStateToAllSources(dragData);

      // Устанавливаем данные в DataTransfer
      console.log('🎯 [UnifiedDragHandlers] Setting DataTransfer data...');
      e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer!.effectAllowed = 'move';
      console.log('✅ [UnifiedDragHandlers] DataTransfer data set');
      console.log('✅ [UnifiedDragHandlers] DataTransfer effectAllowed set to:', e.dataTransfer?.effectAllowed);

      console.log('✅ [UnifiedDragHandlers] ===== BLOCK DRAG START SUCCESS =====');
      return dragData;
    }

    console.warn('⚠️ [UnifiedDragHandlers] No valid drag handle found');
    console.log('🎯 [UnifiedDragHandlers] Available drag handles in DOM:');
    console.log('🎯 [UnifiedDragHandlers] Element handles:', document.querySelectorAll('[data-element-drag-handle="true"]').length);
    console.log('🎯 [UnifiedDragHandlers] Block handles:', document.querySelectorAll('[data-global-drag-handle="true"]').length);

    console.log('❌ [UnifiedDragHandlers] ===== UNIFIED DRAG START FAILED =====');
    return null;
  } catch (error) {
    console.error('❌ [UnifiedDragHandlers] Error in handleUnifiedDragStart:', error);
    console.error('❌ [UnifiedDragHandlers] Error stack:', error.stack);
    console.log('❌ [UnifiedDragHandlers] ===== UNIFIED DRAG START ERROR =====');
    return null;
  }
}

/**
 * Синхронизация drag состояния между всеми источниками
 */
async function syncDragStateToAllSources(dragData: UnifiedDragData): Promise<void> {
  console.log('🔄 [UnifiedDragHandlers] Starting syncDragStateToAllSources with data:', dragData);
  
  try {
    // Синхронизируем с DndCoordinator
    console.log('🎯 [UnifiedDragHandlers] Syncing with DndCoordinator...');
    try {
      const { dndCoordinator } = await import('../dnd/DndCoordinator');
      console.log('📦 [UnifiedDragHandlers] DndCoordinator module loaded');
      
      const coordinatorPayload = {
        type: dragData.type,
        sourceId: dragData.type === 'element' ? dragData.elementId! : dragData.blockId,
        sourceBlockId: dragData.blockId,
        blockId: dragData.blockId,
        elementId: dragData.elementId
      };
      
      console.log('📋 [UnifiedDragHandlers] DndCoordinator payload:', coordinatorPayload);
      dndCoordinator.start(coordinatorPayload);
      console.log('✅ [UnifiedDragHandlers] DndCoordinator synchronized successfully');
    } catch (error) {
      console.error('❌ [UnifiedDragHandlers] DndCoordinator sync failed:', error);
    }

    // Синхронизируем с Window Global State
    console.log('🎯 [UnifiedDragHandlers] Syncing with Window Global State...');
    try {
      if (!(window as any).docmostDragState) {
        (window as any).docmostDragState = {};
        console.log('📦 [UnifiedDragHandlers] Created window.docmostDragState object');
      }
      (window as any).docmostDragState.current = dragData;
      console.log('✅ [UnifiedDragHandlers] Window global state synchronized successfully');
      console.log('📋 [UnifiedDragHandlers] Window global state data:', (window as any).docmostDragState.current);
    } catch (error) {
      console.error('❌ [UnifiedDragHandlers] Window global state sync failed:', error);
    }
    
    console.log('✅ [UnifiedDragHandlers] syncDragStateToAllSources completed successfully');
  } catch (error) {
    console.error('❌ [UnifiedDragHandlers] Critical error in syncDragStateToAllSources:', error);
  }
}

/**
 * Восстановление drag данных из различных источников с правильной последовательностью fallback
 */
async function recoverDragData(e: DragEvent, operation: 'dragover' | 'drop'): Promise<{ dragData: UnifiedDragData | null; fallbackUsed: string }> {
  let dragData: UnifiedDragData | null = null;
  let fallbackUsed = 'none';

  // 1. Первичный источник: DragStateManager
  const dragState = DragStateManager.get();
  if (dragState && DragStateManager.hasValid()) {
    // Преобразуем DragState в UnifiedDragData
    dragData = {
      version: dragState.version,
      type: dragState.type,
      blockId: dragState.blockId,
      elementId: dragState.elementId,
      sourceHandle: dragState.sourceHandle || (dragState.type === 'element' ? 'element' : 'global'),
      timestamp: dragState.timestamp
    };
    fallbackUsed = 'DragStateManager';
    logFallbackTest(TestResult.SUCCESS, `DragStateManager primary source successful in ${operation}`, {
      dragDataType: dragData.type,
      hasElementId: !!dragData.elementId,
      hasBlockId: !!dragData.blockId,
      operation,
      fallbackMethod: 'DragStateManager'
    });
    return { dragData, fallbackUsed };
  }

  // 2. Fallback: DataTransfer (наиболее надежный источник)
  if (e.dataTransfer) {
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const parsed = JSON.parse(jsonData);
        if (parsed && parsed.type && parsed.version === '2.0') {
          dragData = parsed as UnifiedDragData;
          fallbackUsed = 'DataTransfer';
          
          // Восстанавливаем состояние в DragStateManager для будущих вызовов
          DragStateManager.restoreFromFallback(dragData, 'DataTransfer');
          
          logFallbackTest(TestResult.SUCCESS, `DataTransfer fallback successful in ${operation}`, {
            hasJsonData: !!jsonData,
            parsedType: parsed.type,
            version: parsed.version,
            operation,
            fallbackMethod: 'DataTransfer',
            stateRestored: true
          });
          return { dragData, fallbackUsed };
        }
      }
    } catch (error) {
      logFallbackTest(TestResult.FAILED, `DataTransfer fallback failed in ${operation}`, {
        error: error.message,
        hasDataTransfer: !!e.dataTransfer,
        operation,
        fallbackMethod: 'DataTransfer'
      });
    }
  }

  // 3. Fallback: DndCoordinator (для элементов и блоков)
  try {
    const { dndCoordinator } = await import('../dnd/DndCoordinator');
    const coordinatorState = dndCoordinator.getCurrentPayload();
    
    if (coordinatorState && (coordinatorState.type === 'element' || coordinatorState.type === 'block')) {
      // Преобразуем данные из dndCoordinator в формат UnifiedDragData
      dragData = {
        version: '2.0',
        type: coordinatorState.type,
        blockId: coordinatorState.sourceBlockId,
        elementId: coordinatorState.type === 'element' ? coordinatorState.sourceId : undefined,
        sourceHandle: coordinatorState.type === 'element' ? 'element' : 'global',
        timestamp: Date.now()
      };
      
      // Восстанавливаем состояние в DragStateManager для будущих вызовов
      DragStateManager.restoreFromFallback(dragData, 'DndCoordinator');
      fallbackUsed = 'DndCoordinator';
      
      logFallbackTest(TestResult.SUCCESS, `DndCoordinator fallback successful in ${operation}`, {
        coordinatorType: coordinatorState.type,
        sourceBlockId: coordinatorState.sourceBlockId,
        sourceId: coordinatorState.sourceId,
        operation,
        fallbackMethod: 'DndCoordinator',
        stateRestored: true
      });
      return { dragData, fallbackUsed };
    }
  } catch (error) {
    logFallbackTest(TestResult.FAILED, `DndCoordinator fallback failed in ${operation}`, {
      error: error.message,
      operation,
      fallbackMethod: 'DndCoordinator'
    });
  }

  // 4. Fallback: Window global state (последний резерв)
  try {
    const windowState = (window as any).docmostDragState?.current;
    if (windowState && windowState.blockId && windowState.type) {
      dragData = {
        version: '2.0',
        type: windowState.type,
        blockId: windowState.blockId,
        elementId: windowState.elementId,
        sourceHandle: windowState.type === 'element' ? 'element' : 'global',
        timestamp: Date.now()
      };
      
      // Восстанавливаем состояние в DragStateManager для будущих вызовов
      DragStateManager.restoreFromFallback(dragData, 'WindowGlobal');
      fallbackUsed = 'WindowGlobal';
      
      logFallbackTest(TestResult.SUCCESS, `Window global fallback successful in ${operation}`, {
        windowStateType: windowState.type,
        windowStateBlockId: windowState.blockId,
        windowStateElementId: windowState.elementId,
        operation,
        fallbackMethod: 'WindowGlobal',
        stateRestored: true
      });
      return { dragData, fallbackUsed };
    }
  } catch (error) {
    logFallbackTest(TestResult.FAILED, `Window global fallback failed in ${operation}`, {
      error: error.message,
      operation,
      fallbackMethod: 'WindowGlobal'
    });
  }

  // Все fallback методы не сработали
  logFallbackTest(TestResult.FAILED, `All fallback methods failed in ${operation}`, {
    fallbackMethods: ['DragStateManager', 'DataTransfer', 'DndCoordinator', 'WindowGlobal'],
    hasDataTransfer: !!e.dataTransfer,
    dataTransferTypes: e.dataTransfer?.types || [],
    operation,
    fallbackMethod: 'none'
  });

  return { dragData: null, fallbackUsed: 'none' };
}

/**
 * Универсальный обработчик drag over
 */
export async function handleUnifiedDragOver(e: DragEvent): Promise<boolean> {
  try {
    // Восстанавливаем drag данные с правильной последовательностью fallback
    const { dragData, fallbackUsed } = await recoverDragData(e, 'dragover');

    if (!dragData) {
      return false;
    }

    // Логируем успешное восстановление данных
    logFallbackTest(TestResult.SUCCESS, `Drag data recovered successfully in dragover: ${fallbackUsed}`, {
      fallbackMethod: fallbackUsed,
      dragDataType: dragData.type,
      hasElementId: !!dragData.elementId,
      hasBlockId: !!dragData.blockId,
      operation: 'dragover'
    });

    // Проверяем необходимость принудительной очистки
    await checkAndCleanupIfNeeded();

    // Сценарий 1: перетаскиваем элемент
    if (dragData.type === 'element') {
      // 🔧 ИСПРАВЛЕНИЕ: Улучшенный поиск элементов
      const targetElement = findTargetElement(e.target as HTMLElement);
      const targetBlock = (e.target as HTMLElement).closest('[data-block-id]');

      const targetElementId = targetElement?.getAttribute('data-element-id');
      const targetBlockId = targetBlock?.getAttribute('data-block-id');

      // 🔧 ИСПРАВЛЕНИЕ: Проверяем на дубликаты dragover
      if (isDuplicateDragOver(e, targetElementId, targetBlockId)) {
        return true; // Возвращаем true, чтобы не прерывать drag
      }

      if (targetElement || targetBlock) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';

        // Подсвечиваем drop-зону элемента
        if (targetElement) {
          targetElement.classList.add('drag-over-element');
        } else if (targetBlock) {
          targetBlock.classList.add('drag-over-block');
        }

        // 🔧 ИСПРАВЛЕНИЕ: Обновляем кэш
        updateDragOverCache(e, targetElementId, targetBlockId);

        return true;
      }
    }

    // Сценарий 2: перетаскиваем блок
    if (dragData.type === 'block') {
      const targetBlock = (e.target as HTMLElement).closest('[data-block-id]');
      const targetBlockId = targetBlock?.getAttribute('data-block-id');

      // 🔧 ИСПРАВЛЕНИЕ: Проверяем на дубликаты dragover
      if (isDuplicateDragOver(e, undefined, targetBlockId)) {
        return true; // Возвращаем true, чтобы не прерывать drag
      }

      if (targetBlock && targetBlockId !== dragData.blockId) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';

        // Подсвечиваем drop-зону блока
        targetBlock.classList.add('drag-over-block');

        // 🔧 ИСПРАВЛЕНИЕ: Обновляем кэш
        updateDragOverCache(e, undefined, targetBlockId);

        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ [UnifiedDragHandlers] Error in handleUnifiedDragOver:', error);
    console.error('❌ [UnifiedDragHandlers] Error stack:', error.stack);
    console.log('❌ [UnifiedDragHandlers] ===== UNIFIED DRAG OVER ERROR =====');
    return false;
  }
}

/**
 * Универсальный обработчик drop
 */
export async function handleUnifiedDrop(
  e: DragEvent,
  onElementMove?: (sourceBlockId: string, elementId: string, targetBlockId: string, beforeElementId?: string) => void,
  onBlockMove?: (sourceBlockId: string, targetBlockId: string, position?: 'before' | 'after' | 'inside') => void
): Promise<boolean> {
  console.log('🎯 [UnifiedDragHandlers] ===== UNIFIED DROP START =====');

  try {
    // Восстанавливаем drag данные с правильной последовательностью fallback
    const { dragData, fallbackUsed } = await recoverDragData(e, 'drop');

    if (!dragData) {
      console.log('❌ [UnifiedDragHandlers] No drag data recovered, drop failed');
      console.log('❌ [UnifiedDragHandlers] ===== UNIFIED DROP FAILED (NO DATA) =====');
      return false;
    }

    // Логируем успешное восстановление данных
    logFallbackTest(TestResult.SUCCESS, `Drag data recovered successfully in drop: ${fallbackUsed}`, {
      fallbackMethod: fallbackUsed,
      dragDataType: dragData.type,
      hasElementId: !!dragData.elementId,
      hasBlockId: !!dragData.blockId,
      operation: 'drop'
    });

    console.log('✅ [UnifiedDragHandlers] Drag data recovered:', {
      type: dragData.type,
      blockId: dragData.blockId,
      elementId: dragData.elementId,
      fallbackUsed
    });

    // Проверяем необходимость принудительной очистки
    await checkAndCleanupIfNeeded();

    // Drop with valid data

    // Сценарий 1: перетаскиваем элемент
    if (dragData.type === 'element') {
      console.log('🎯 [UnifiedDragHandlers] Processing element drop...');
      const targetElement = (e.target as HTMLElement).closest('[data-element-id]');
      const targetBlock = (e.target as HTMLElement).closest('[data-block-id]');

      console.log('🎯 [UnifiedDragHandlers] Target element found:', !!targetElement);
      console.log('🎯 [UnifiedDragHandlers] Target block found:', !!targetBlock);
      console.log('🎯 [UnifiedDragHandlers] Target element ID:', targetElement?.getAttribute('data-element-id'));
      console.log('🎯 [UnifiedDragHandlers] Target block ID:', targetBlock?.getAttribute('data-block-id'));

      if (!targetBlock) {
        console.error('❌ [UnifiedDragHandlers] Target block not found for element drop');
        console.log('❌ [UnifiedDragHandlers] ===== ELEMENT DROP FAILED =====');
        return false;
      }

      const targetBlockId = targetBlock.getAttribute('data-block-id')!;
      const targetElementId = targetElement?.getAttribute('data-element-id');

      // 🔧 ИСПРАВЛЕНИЕ: Правильно определяем beforeElementId
      let beforeElementId: string | undefined = undefined;
      let targetPosition: 'before' | 'after' = 'after';

      console.log('🔄 [UnifiedDragHandlers] Determining drop position:', {
        targetElementId,
        dragDataElementId: dragData.elementId,
        isSameElement: targetElementId === dragData.elementId,
        hasTargetElement: !!targetElementId,
        isBlockHandle: !targetElementId && targetBlock
      });

      // 🔧 ИСПРАВЛЕНИЕ: Улучшенное определение позиции drop
      // Если нет конкретного targetElementId, но есть targetBlock, 
      // определяем позицию на основе координат мыши относительно блока
      if (!targetElementId && targetBlock) {
        console.log('🔄 [UnifiedDragHandlers] No specific element target, determining position by mouse coordinates');
        
        // Получаем все элементы в блоке
        const allElements = targetBlock.querySelectorAll('[data-element-id]');
        console.log('🔄 [UnifiedDragHandlers] Found elements in block:', allElements.length);
        
        if (allElements.length > 0) {
          // Определяем позицию на основе координат мыши
          const mouseY = e.clientY;
          let closestElement = null;
          let closestDistance = Infinity;
          let insertIndex = 0;
          
          // Находим ближайший элемент по Y координате
          allElements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const elementCenterY = rect.top + rect.height / 2;
            const distance = Math.abs(mouseY - elementCenterY);
            
            if (distance < closestDistance) {
              closestDistance = distance;
              closestElement = element;
              insertIndex = index;
            }
          });
          
          if (closestElement) {
            const rect = closestElement.getBoundingClientRect();
            const elementCenterY = rect.top + rect.height / 2;
            
            if (mouseY < elementCenterY) {
              // Вставляем перед ближайшим элементом
              beforeElementId = closestElement.getAttribute('data-element-id') || undefined;
              targetPosition = 'before';
              console.log('🔄 [UnifiedDragHandlers] Inserting before element:', beforeElementId);
            } else {
              // Вставляем после ближайшего элемента
              const nextElement = allElements[insertIndex + 1] as HTMLElement;
              beforeElementId = nextElement?.getAttribute('data-element-id') || undefined;
              targetPosition = 'after';
              console.log('🔄 [UnifiedDragHandlers] Inserting after element, beforeElementId:', beforeElementId);
            }
          } else {
            // Fallback: вставляем в начало
            beforeElementId = undefined;
            targetPosition = 'after';
            console.log('🔄 [UnifiedDragHandlers] No closest element found, inserting at beginning');
          }
        } else {
          // Нет элементов в блоке, вставляем в начало
          beforeElementId = undefined;
          targetPosition = 'after';
          console.log('🔄 [UnifiedDragHandlers] No elements in block, inserting at beginning');
        }
      } else if (targetElementId && targetElementId !== dragData.elementId) {
        // Определяем позицию относительно целевого элемента на основе координат мыши
        const targetRect = targetElement!.getBoundingClientRect();
        const mouseY = e.clientY;
        const elementCenter = targetRect.top + targetRect.height / 2;

        if (mouseY < elementCenter) {
          // Дропаем перед элементом
          beforeElementId = targetElementId;
          targetPosition = 'before';
        } else {
          // Дропаем после элемента - находим следующий элемент
          const parentList = targetElement!.closest('ul, ol');
          if (parentList) {
            const allItems = Array.from(parentList.querySelectorAll('[data-element-id]'));
            const currentIndex = allItems.indexOf(targetElement!);
            const nextElement = allItems[currentIndex + 1] as HTMLElement;
            beforeElementId = nextElement?.getAttribute('data-element-id') ?? undefined;
          }
          targetPosition = 'after';
        }
      } else if (targetElementId === dragData.elementId) {
        // 🔧 ИСПРАВЛЕНИЕ: Обрабатываем случай перетаскивания на самого себя
        console.log('🔄 [UnifiedDragHandlers] Processing self-drop case:', {
          targetElementId,
          dragDataElementId: dragData.elementId,
          mouseY: e.clientY
        });
        
        // Определяем позицию на основе координат мыши
        const targetRect = targetElement!.getBoundingClientRect();
        const mouseY = e.clientY;
        const elementCenter = targetRect.top + targetRect.height / 2;

        console.log('🔄 [UnifiedDragHandlers] Self-drop position calculation:', {
          mouseY,
          elementCenter,
          targetRectTop: targetRect.top,
          targetRectHeight: targetRect.height,
          isAboveCenter: mouseY < elementCenter
        });

        if (mouseY < elementCenter) {
          // Дропаем перед самим собой - находим предыдущий элемент
          console.log('🔄 [UnifiedDragHandlers] Dropping before self, finding previous element...');
          const parentList = targetElement!.closest('ul, ol');
          if (parentList) {
            const allItems = Array.from(parentList.querySelectorAll('[data-element-id]'));
            const currentIndex = allItems.indexOf(targetElement!);
            const prevElement = allItems[currentIndex - 1] as HTMLElement;
            // 🔧 ИСПРАВЛЕНИЕ: Если есть предыдущий элемент, вставляем после него
            // Если нет предыдущего элемента, вставляем в начало (beforeElementId = undefined)
            beforeElementId = prevElement?.getAttribute('data-element-id') ?? undefined;
            console.log('🔄 [UnifiedDragHandlers] Found previous element:', {
              currentIndex,
              prevElementId: prevElement?.getAttribute('data-element-id'),
              beforeElementId,
              allItemsCount: allItems.length
            });
          }
          targetPosition = 'before';
        } else {
          // Дропаем после самого себя - находим следующий элемент
          console.log('🔄 [UnifiedDragHandlers] Dropping after self, finding next element...');
          const parentList = targetElement!.closest('ul, ol');
          if (parentList) {
            const allItems = Array.from(parentList.querySelectorAll('[data-element-id]'));
            const currentIndex = allItems.indexOf(targetElement!);
            const nextElement = allItems[currentIndex + 1] as HTMLElement;
            // 🔧 ИСПРАВЛЕНИЕ: Если есть следующий элемент, вставляем перед ним
            // Если нет следующего элемента, вставляем в конец (beforeElementId = undefined)
            beforeElementId = nextElement?.getAttribute('data-element-id') ?? undefined;
            console.log('🔄 [UnifiedDragHandlers] Found next element:', {
              currentIndex,
              nextElementId: nextElement?.getAttribute('data-element-id'),
              beforeElementId,
              allItemsCount: allItems.length
            });
          }
          targetPosition = 'after';
        }
        
        console.log('🔄 [UnifiedDragHandlers] Self-drop result:', {
          targetPosition,
          beforeElementId,
          originalTargetElementId: targetElementId
        });
      } else {
        // Если перетаскиваем на блок без конкретного элемента, вставляем в начало
        targetPosition = 'after';
        beforeElementId = undefined;
      }

      console.log('✅ [UnifiedDragHandlers] Element drop details:', {
        sourceBlockId: dragData.blockId,
        elementId: dragData.elementId,
        targetBlockId,
        targetElementId,
        beforeElementId,
        targetPosition,
        isCrossBlock: dragData.blockId !== targetBlockId,
        isReorder: targetElementId && targetElementId !== dragData.elementId
      });

      // Вызываем callback для перемещения элемента
      if (onElementMove) {
        console.log('🎯 [UnifiedDragHandlers] Calling onElementMove callback...');
        onElementMove(dragData.blockId, dragData.elementId!, targetBlockId, beforeElementId);
        console.log('✅ [UnifiedDragHandlers] onElementMove callback called');
      } else {
        console.warn('⚠️ [UnifiedDragHandlers] No onElementMove callback provided');
      }

      // 🔧 ИСПРАВЛЕНИЕ: Очищаем кэш dragover
      clearDragOverCache();

      console.log('✅ [UnifiedDragHandlers] ===== ELEMENT DROP SUCCESS =====');
      return true;
    }

    // Сценарий 2: перетаскиваем блок
    if (dragData.type === 'block') {
      console.log('🎯 [UnifiedDragHandlers] Processing block drop...');
      const targetBlock = (e.target as HTMLElement).closest('[data-block-id]');

      console.log('🎯 [UnifiedDragHandlers] Target block found:', !!targetBlock);
      console.log('🎯 [UnifiedDragHandlers] Target block ID:', targetBlock?.getAttribute('data-block-id'));
      console.log('🎯 [UnifiedDragHandlers] Source block ID:', dragData.blockId);

      if (!targetBlock) {
        console.error('❌ [UnifiedDragHandlers] Target block not found for block drop');
        console.log('❌ [UnifiedDragHandlers] ===== BLOCK DROP FAILED =====');
        return false;
      }

      const targetBlockId = targetBlock.getAttribute('data-block-id')!;

      if (targetBlockId === dragData.blockId) {
        console.log('⚠️ [UnifiedDragHandlers] Block drop on itself, ignoring');
        console.log('❌ [UnifiedDragHandlers] ===== BLOCK DROP FAILED (SAME BLOCK) =====');
        return false;
      }

      console.log('✅ [UnifiedDragHandlers] Block drop details:', {
        sourceBlockId: dragData.blockId,
        targetBlockId
      });

      // Вызываем callback для перемещения блока
      if (onBlockMove) {
        console.log('🎯 [UnifiedDragHandlers] Calling onBlockMove callback...');
        onBlockMove(dragData.blockId, targetBlockId);
        console.log('✅ [UnifiedDragHandlers] onBlockMove callback called');
      } else {
        console.warn('⚠️ [UnifiedDragHandlers] No onBlockMove callback provided');
      }

      // 🔧 ИСПРАВЛЕНИЕ: Очищаем кэш dragover
      clearDragOverCache();

      console.log('✅ [UnifiedDragHandlers] ===== BLOCK DROP SUCCESS =====');
      return true;
    }

    console.log('⚠️ [UnifiedDragHandlers] No valid drop scenario matched');
    console.log('❌ [UnifiedDragHandlers] ===== UNIFIED DROP FAILED =====');
    return false;
  } catch (error) {
    console.error('❌ [UnifiedDragHandlers] Error in handleUnifiedDrop:', error);
    console.error('❌ [UnifiedDragHandlers] Error stack:', error.stack);
    console.log('❌ [UnifiedDragHandlers] ===== UNIFIED DROP ERROR =====');
    return false;
  }
}

/**
 * Проверяет необходимость принудительной очистки состояния
 */
async function checkAndCleanupIfNeeded(): Promise<void> {
  if (DragStateManager.shouldForceCleanup()) {
    const stats = DragStateManager.getRecoveryStats();
    console.warn('⚠️ [UnifiedDragHandlers] Force cleanup triggered due to frequent fallback recoveries:', stats);
    
    logFallbackTest(TestResult.PARTIAL, 'Force cleanup triggered due to frequent fallback recoveries', {
      recoveryCount: stats.count,
      lastRecoveryTime: stats.lastTime,
      isRecent: stats.isRecent,
      reason: 'frequent_fallback_recoveries'
    });
    
    await cleanupDragState();
  }
}

/**
 * Очистка drag состояния
 */
export async function cleanupDragState(): Promise<void> {
  console.log('🧹 [UnifiedDragHandlers] ===== CLEANUP DRAG STATE =====');

  try {
    // Очищаем через безопасный менеджер состояния
    console.log('🧹 [UnifiedDragHandlers] Clearing drag state from DragStateManager...');
    DragStateManager.clear();
    console.log('✅ [UnifiedDragHandlers] Drag state cleared from DragStateManager');

    // Очищаем DndCoordinator
    try {
      const dndCoordinatorModule = await import('../dnd/DndCoordinator');
      const dndCoordinator = dndCoordinatorModule.dndCoordinator;
      dndCoordinator.forceCleanup();
      console.log('✅ [UnifiedDragHandlers] DndCoordinator force cleanup completed');
    } catch (error) {
      console.warn('⚠️ [UnifiedDragHandlers] DndCoordinator cleanup failed:', error);
    }

    // Очищаем window global state
    try {
      if ((window as any).docmostDragState) {
        (window as any).docmostDragState.current = null;
        console.log('✅ [UnifiedDragHandlers] Window global state cleared');
      }
    } catch (error) {
      console.warn('⚠️ [UnifiedDragHandlers] Window global state cleanup failed:', error);
    }

    // Очищаем DataTransfer (если возможно)
    try {
      // DataTransfer очищается автоматически браузером, но можем попробовать очистить кэш
      if ((window as any).dragDataCache) {
        (window as any).dragDataCache = null;
        console.log('✅ [UnifiedDragHandlers] DataTransfer cache cleared');
      }
    } catch (error) {
      console.warn('⚠️ [UnifiedDragHandlers] DataTransfer cache cleanup failed:', error);
    }

    // Убираем все подсветки
    console.log('🧹 [UnifiedDragHandlers] Removing drag over highlights...');
    const highlightedElements = document.querySelectorAll('.drag-over-element, .drag-over-block');
    console.log('🧹 [UnifiedDragHandlers] Found highlighted elements:', highlightedElements.length);

    highlightedElements.forEach((el, index) => {
      el.classList.remove('drag-over-element', 'drag-over-block');
      console.log(`🧹 [UnifiedDragHandlers] Removed highlights from element ${index + 1}:`, el);
    });

    console.log('✅ [UnifiedDragHandlers] All drag over highlights removed');
    console.log('✅ [UnifiedDragHandlers] ===== CLEANUP DRAG STATE SUCCESS =====');
  } catch (error) {
    console.error('❌ [UnifiedDragHandlers] Error in cleanupDragState:', error);
    console.error('❌ [UnifiedDragHandlers] Error stack:', error.stack);
    console.log('❌ [UnifiedDragHandlers] ===== CLEANUP DRAG STATE ERROR =====');
  }
}
