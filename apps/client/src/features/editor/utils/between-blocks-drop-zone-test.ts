/**
 * Тестовые утилиты для проверки функционала дроп зон между блоками
 */

export const testBetweenBlocksDropZoneFunctionality = () => {
  console.log('🧪 [BetweenBlocksDropZoneTest] Testing between-blocks drop zone functionality...');

  // Проверяем наличие дроп зон между блоками в DOM
  const betweenBlocksDropZones = document.querySelectorAll('[data-drop-zone-type="between-blocks"]');
  console.log('🧪 [BetweenBlocksDropZoneTest] Found between-blocks drop zones:', betweenBlocksDropZones.length);

  betweenBlocksDropZones.forEach((zone, index) => {
    const afterBlockId = zone.getAttribute('data-after-block-id');
    const beforeBlockId = zone.getAttribute('data-before-block-id');
    const isVisible = (zone as HTMLElement).style.display !== 'none';
    const hasDragOver = zone.classList.contains('drag-over');

    console.log(`🧪 [BetweenBlocksDropZoneTest] Between-blocks drop zone ${index}:`, {
      afterBlockId,
      beforeBlockId,
      isVisible,
      hasDragOver,
      className: zone.className
    });
  });

  // Проверяем наличие блоков
  const blocks = document.querySelectorAll('[data-block-id]');
  console.log('🧪 [BetweenBlocksDropZoneTest] Found blocks:', blocks.length);

  // Проверяем наличие элементов для драга
  const draggableElements = document.querySelectorAll('[data-element-drag-handle="true"]');
  console.log('🧪 [BetweenBlocksDropZoneTest] Found draggable elements:', draggableElements.length);

  // Проверяем наличие глобальных событий
  const hasGlobalEventListeners = {
    'global-element-drag-start': document.addEventListener.toString().includes('global-element-drag-start'),
    'global-element-drag-end': document.addEventListener.toString().includes('global-element-drag-end')
  };

  console.log('🧪 [BetweenBlocksDropZoneTest] Global event listeners status:', hasGlobalEventListeners);

  return {
    betweenBlocksDropZonesCount: betweenBlocksDropZones.length,
    blocksCount: blocks.length,
    draggableElementsCount: draggableElements.length,
    hasGlobalEventListeners
  };
};

export const simulateElementDragToBetweenBlocksZone = (elementId: string, dropZoneIndex: number) => {
  console.log('🧪 [BetweenBlocksDropZoneTest] Simulating element drag to between-blocks zone:', { elementId, dropZoneIndex });

  const dropZones = document.querySelectorAll('[data-drop-zone-type="between-blocks"]');
  const dropZone = dropZones[dropZoneIndex];

  if (!dropZone) {
    console.error('🧪 [BetweenBlocksDropZoneTest] Drop zone not found at index:', dropZoneIndex);
    return false;
  }

  const element = document.querySelector(`[data-element-id="${elementId}"]`);
  if (!element) {
    console.error('🧪 [BetweenBlocksDropZoneTest] Element not found:', elementId);
    return false;
  }

  // Симулируем drag start
  const dragStartEvent = new CustomEvent('global-element-drag-start', {
    detail: {
      type: 'element',
      elementId: elementId,
      blockId: element.closest('[data-block-id]')?.getAttribute('data-block-id'),
      version: '2.0',
      timestamp: Date.now()
    }
  });

  document.dispatchEvent(dragStartEvent);
  console.log('🧪 [BetweenBlocksDropZoneTest] Global element drag start event dispatched');

  // Симулируем drag over
  const dragOverEvent = new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100
  });

  dropZone.dispatchEvent(dragOverEvent);
  console.log('🧪 [BetweenBlocksDropZoneTest] Drag over event dispatched to drop zone');

  // Симулируем drop
  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100
  });

  dropZone.dispatchEvent(dropEvent);
  console.log('🧪 [BetweenBlocksDropZoneTest] Drop event dispatched to drop zone');

  // Симулируем drag end
  const dragEndEvent = new CustomEvent('global-element-drag-end');
  document.dispatchEvent(dragEndEvent);
  console.log('🧪 [BetweenBlocksDropZoneTest] Global element drag end event dispatched');

  return true;
};

export const checkBetweenBlocksDropZoneStyles = () => {
  console.log('🧪 [BetweenBlocksDropZoneTest] Checking between-blocks drop zone styles...');

  const dropZones = document.querySelectorAll('[data-drop-zone-type="between-blocks"]');

  dropZones.forEach((zone, index) => {
    const computedStyle = window.getComputedStyle(zone);

    console.log(`🧪 [BetweenBlocksDropZoneTest] Drop zone ${index} styles:`, {
      display: computedStyle.display,
      position: computedStyle.position,
      minHeight: computedStyle.minHeight,
      border: computedStyle.border,
      borderRadius: computedStyle.borderRadius,
      backgroundColor: computedStyle.backgroundColor,
      opacity: computedStyle.opacity,
      zIndex: computedStyle.zIndex
    });
  });

  return dropZones.length;
};

// Глобальная функция для тестирования (доступна в консоли браузера)
if (typeof window !== 'undefined') {
  (window as any).testBetweenBlocksDropZone = testBetweenBlocksDropZoneFunctionality;
  (window as any).simulateElementDragToBetweenBlocks = simulateElementDragToBetweenBlocksZone;
  (window as any).checkBetweenBlocksDropZoneStyles = checkBetweenBlocksDropZoneStyles;
}
