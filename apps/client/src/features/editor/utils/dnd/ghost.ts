/**
 * Утилиты для создания ghost элементов при drag-and-drop
 */

export function createLarkGhost(
  source: HTMLElement,
  type: 'block' | 'list-item' | 'table-row' | 'element',
  initialMouseX?: number,
  initialMouseY?: number
) {
  console.log('[DBG] createLarkGhost called', { source, type, initialMouseX, initialMouseY });

  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.classList.add('lark-ghost', `lark-ghost-${type}`);

  console.log('[DBG] Ghost element created:', {
    tagName: ghost.tagName,
    className: ghost.className,
    innerHTML: ghost.innerHTML.substring(0, 200) + '...',
    offsetWidth: ghost.offsetWidth,
    offsetHeight: ghost.offsetHeight
  });

  // Получаем точные размеры исходного элемента
  const sourceRect = source.getBoundingClientRect();

  ghost.style.position = 'fixed';
  ghost.style.top = '0';
  ghost.style.left = '0';
  ghost.style.width = `${sourceRect.width}px`;
  ghost.style.height = `${sourceRect.height}px`;
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '9999';
  ghost.style.opacity = '0.8';
  ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  ghost.style.borderRadius = '4px';
  ghost.style.background = 'rgba(255, 255, 255, 0.95)';
  ghost.style.border = '1px solid rgba(0, 0, 0, 0.1)';
  ghost.style.backdropFilter = 'blur(4px)';

  const dragHandles = ghost.querySelectorAll('.drag-handle, .drag-handle-icon, [draggable="true"]');
  dragHandles.forEach(handle => {
    if (handle instanceof HTMLElement) {
      handle.style.display = 'none';
    }
  });

  document.body.appendChild(ghost);
  console.log('[DBG] Ghost appended to DOM', ghost);
  console.log('[DBG] Ghost computed styles:', {
    position: window.getComputedStyle(ghost).position,
    zIndex: window.getComputedStyle(ghost).zIndex,
    opacity: window.getComputedStyle(ghost).opacity,
    transform: window.getComputedStyle(ghost).transform,
    display: window.getComputedStyle(ghost).display,
    visibility: window.getComputedStyle(ghost).visibility
  });

  // Используем throttling для плавного движения
  let lastMoveTime = 0;
  const throttleDelay = 16; // ~60fps

  const move = (ev: MouseEvent | DragEvent) => {
    const now = Date.now();
    if (now - lastMoveTime < throttleDelay) return;
    lastMoveTime = now;

    const x = ev.clientX + 12;
    const y = ev.clientY + 12;
    ghost.style.transform = `translate(${x}px, ${y}px)`;
    console.log('[DBG] Ghost position:', { x, y, clientX: ev.clientX, clientY: ev.clientY });
  };

  // Сразу устанавливаем начальную позицию
  if (initialMouseX !== undefined && initialMouseY !== undefined) {
    const initialX = initialMouseX + 12;
    const initialY = initialMouseY + 12;
    ghost.style.transform = `translate(${initialX}px, ${initialY}px)`;
    console.log('[DBG] Initial ghost position:', { initialX, initialY });
  }

  // Слушаем dragover для движения во время drag
  document.addEventListener('dragover', move, { passive: true });
  // Слушаем mousemove для движения после drag
  window.addEventListener('mousemove', move, { passive: true });

  const cleanup = () => {
    ghost.remove();
    document.removeEventListener('dragover', move);
    window.removeEventListener('mousemove', move);
  };

  window.addEventListener('mouseup', cleanup, { once: true, passive: true });
  document.addEventListener('drop', cleanup, { once: true, passive: true });

  return ghost;
}

export function disableDefaultDragImage(event: DragEvent): void {
  console.log('🚫 [Ghost] Disabling default drag image');
  
  if (event.dataTransfer) {
    // Создаем прозрачный элемент для замены стандартного drag image
    const dragImage = document.createElement('div');
    dragImage.style.width = '1px';
    dragImage.style.height = '1px';
    dragImage.style.opacity = '0';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    
    document.body.appendChild(dragImage);
    
    try {
      event.dataTransfer.setDragImage(dragImage, 0, 0);
      console.log('✅ [Ghost] Default drag image disabled');
    } catch (error) {
      console.warn('⚠️ [Ghost] Could not set drag image:', error);
    } finally {
      // Удаляем временный элемент
      setTimeout(() => {
        if (dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage);
        }
      }, 100);
    }
  }
}