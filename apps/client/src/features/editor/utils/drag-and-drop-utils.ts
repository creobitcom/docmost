import { Editor } from '@tiptap/core';
import { logBlockTypeTest, TestResult } from './dnd-test-logger';

// Типы для drag-and-drop операций
export interface DragOperation {
  type: 'block' | 'element';
  sourceId: string;
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

export interface BlockMoveOperation {
  sourceBlockId: string;
  targetBlockId: string;
  position: 'before' | 'after';
}

export interface ElementMoveOperation {
  sourceElementId: string;
  targetBlockId: string;
  position: 'before' | 'after' | 'inside';
}

// Утилиты для работы с блоками
export const findBlockPosition = (editor: Editor, blockId: string): number => {
  let pos = 0;
  
  editor.state.doc.descendants((node, nodePos) => {
    if (node.attrs.id === blockId) {
      pos = nodePos;
      return false;
    }
  });
  
  return pos;
};

export const findElementPosition = (editor: Editor, elementId: string): number => {
  let pos = 0;
  
  editor.state.doc.descendants((node, nodePos) => {
    if (node.attrs.id === elementId) {
      pos = nodePos;
      return false;
    }
  });
  
  return pos;
};

// Функция для перемещения блока
export const moveBlock = (
  editor: Editor, 
  sourceBlockId: string, 
  targetBlockId: string, 
  position: 'before' | 'after'
): boolean => {
  const sourcePos = findBlockPosition(editor, sourceBlockId);
  const targetPos = findBlockPosition(editor, targetBlockId);
  
  if (sourcePos === -1 || targetPos === -1) {
    console.warn('[DnD] Invalid block positions:', { sourcePos, targetPos });
    return false;
  }
  
  const sourceNode = editor.state.doc.nodeAt(sourcePos);
  if (!sourceNode) {
    console.warn('[DnD] Source node not found at position:', sourcePos);
    return false;
  }
  
  console.log('[DnD] Moving block:', {
    sourceBlockId,
    targetBlockId,
    position,
    sourcePos,
    targetPos,
    sourceNodeSize: sourceNode.nodeSize
  });
  
  const tr = editor.state.tr;
  
  // Удаляем блок из исходной позиции
  tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
  
  // Корректируем целевую позицию, если она была после исходной позиции
  let adjustedTargetPos = targetPos;
  if (targetPos > sourcePos) {
    adjustedTargetPos = targetPos - sourceNode.nodeSize;
  }
  
  // Определяем целевую позицию
  let insertPos = adjustedTargetPos;
  if (position === 'after') {
    const targetNode = editor.state.doc.nodeAt(adjustedTargetPos);
    if (targetNode) {
      insertPos = adjustedTargetPos + targetNode.nodeSize;
    }
  }
  
  // Вставляем блок в целевую позицию
  tr.insert(insertPos, sourceNode);
  
  // Применяем изменения
  editor.view.dispatch(tr);
  
  console.log('[DnD] Block moved successfully');
  return true;
};

// Функция для перемещения элемента между блоками
export const moveElementBetweenBlocks = (
  editor: Editor,
  sourceElementId: string,
  targetBlockId: string,
  position: 'before' | 'after' | 'inside'
): boolean => {
  const sourcePos = findElementPosition(editor, sourceElementId);
  const targetPos = findBlockPosition(editor, targetBlockId);
  
  if (sourcePos === -1 || targetPos === -1) {
    console.warn('[DnD] Invalid positions:', { sourcePos, targetPos });
    return false;
  }
  
  const sourceNode = editor.state.doc.nodeAt(sourcePos);
  const targetNode = editor.state.doc.nodeAt(targetPos);
  
  if (!sourceNode || !targetNode) {
    console.warn('[DnD] Invalid nodes at positions:', { sourcePos, targetPos });
    return false;
  }
  
  // Проверяем совместимость типов
  if (!isCompatibleElementType(sourceNode, targetNode)) {
    logBlockTypeTest(TestResult.FAILED, 'Incompatible element types detected', {
      sourceType: getElementType(sourceNode),
      targetType: getBlockType(targetNode),
      sourceElementId,
      targetBlockId,
      operation: 'moveElementBetweenBlocks'
    });
    return false;
  }
  
  console.log('[DnD] Moving element:', {
    sourceElementId,
    targetBlockId,
    position,
    sourcePos,
    targetPos,
    sourceNodeSize: sourceNode.nodeSize,
    targetNodeSize: targetNode.nodeSize
  });
  
  const tr = editor.state.tr;
  
  // Удаляем элемент из исходной позиции
  tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
  
  // Корректируем целевую позицию, если она была после исходной позиции
  let adjustedTargetPos = targetPos;
  if (targetPos > sourcePos) {
    adjustedTargetPos = targetPos - sourceNode.nodeSize;
  }
  
  if (position === 'inside') {
    // Вставляем элемент внутрь блока
    const targetContentPos = adjustedTargetPos + 1; // Позиция после открывающего тега блока
    tr.insert(targetContentPos, sourceNode);
  } else {
    // Вставляем элемент рядом с блоком
    let insertPos = adjustedTargetPos;
    if (position === 'after') {
      insertPos = adjustedTargetPos + targetNode.nodeSize;
    }
    tr.insert(insertPos, sourceNode);
  }
  
  // Применяем изменения
  editor.view.dispatch(tr);
  
  logBlockTypeTest(TestResult.SUCCESS, 'Element moved successfully between compatible types', {
    sourceElementId,
    targetBlockId,
    position,
    sourceType: getElementType(sourceNode),
    targetType: getBlockType(targetNode),
    operation: 'moveElementBetweenBlocks'
  });
  
  // Создаем событие для уведомления о перемещении элемента
  const eventDetail = {
    elementId: sourceElementId,
    targetBlockId: targetBlockId,
    position: position,
    sourceType: getElementType(sourceNode),
    targetType: getBlockType(targetNode)
  };
  
  console.log('🎯 [DragAndDropUtils] ===== CREATING ELEMENT DROP EVENT =====');
  console.log('🎯 [DragAndDropUtils] Event detail:', eventDetail);
  
  const elementDropEvent = new CustomEvent('element-drop', {
    detail: eventDetail
  });
  
  console.log('🎯 [DragAndDropUtils] Event created:', {
    type: elementDropEvent.type,
    detail: elementDropEvent.detail,
    bubbles: elementDropEvent.bubbles,
    cancelable: elementDropEvent.cancelable
  });
  
  // Отправляем событие в document для обработки в page-editor
  console.log('🎯 [DragAndDropUtils] Dispatching element-drop event...');
  document.dispatchEvent(elementDropEvent);
  console.log('✅ [DragAndDropUtils] Element drop event dispatched successfully');
  console.log('✅ [DragAndDropUtils] ===== ELEMENT DROP EVENT DISPATCHED =====');
  
  return true;
};

// Функция для перемещения элемента (устаревшая, используйте moveElementBetweenBlocks)
export const moveElement = (
  editor: Editor,
  sourceElementId: string,
  targetBlockId: string,
  position: 'before' | 'after' | 'inside'
): boolean => {
  return moveElementBetweenBlocks(editor, sourceElementId, targetBlockId, position);
};

// Функция для создания нового блока из элемента
export const createBlockFromElement = (
  editor: Editor,
  sourceElementId: string,
  targetBlockId: string
): boolean => {
  const sourcePos = findElementPosition(editor, sourceElementId);
  const targetPos = findBlockPosition(editor, targetBlockId);
  
  if (sourcePos === -1 || targetPos === -1) {
    logBlockTypeTest(TestResult.FAILED, 'Invalid positions for block creation', {
      sourcePos,
      targetPos,
      sourceElementId,
      targetBlockId,
      operation: 'createBlockFromElement'
    });
    return false;
  }
  
  const sourceNode = editor.state.doc.nodeAt(sourcePos);
  const targetNode = editor.state.doc.nodeAt(targetPos);
  
  if (!sourceNode || !targetNode) {
    logBlockTypeTest(TestResult.FAILED, 'Invalid nodes for block creation', {
      sourcePos,
      targetPos,
      sourceElementId,
      targetBlockId,
      operation: 'createBlockFromElement'
    });
    return false;
  }
  
  const tr = editor.state.tr;
  
  // Удаляем элемент из исходной позиции
  tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
  
  // Создаем новый блок с содержимым элемента
  const newBlock = editor.schema.nodes.paragraph.create(
    { id: generateUniqueId() },
    sourceNode.content
  );
  
  // Вставляем новый блок после целевого блока
  const insertPos = targetPos + targetNode.nodeSize;
  tr.insert(insertPos, newBlock);
  
  // Применяем изменения
  editor.view.dispatch(tr);
  
  // Логируем успешное создание блока
  logBlockTypeTest(TestResult.SUCCESS, 'Block created successfully from element', {
    sourceElementId,
    targetBlockId,
    sourceType: getElementType(sourceNode),
    targetType: getBlockType(targetNode),
    newBlockId: newBlock.attrs.id,
    operation: 'createBlockFromElement'
  });
  
  return true;
};

// Функция для генерации уникального ID
export const generateUniqueId = (): string => {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Функция для проверки совместимости типов элементов
export const isCompatibleElementType = (
  sourceNode: any,
  targetNode: any
): boolean => {
  // Проверяем, можно ли переместить элемент в целевой блок
  const sourceType = sourceNode.type.name;
  const targetType = targetNode.type.name;
  
  // Список совместимых типов
  const compatibleTypes: Record<string, string[]> = {
    listItem: ['bulletList', 'orderedList'],
    taskItem: ['taskList'],
    tableRow: ['table'],
    tableCell: ['tableRow'],
    paragraph: ['doc', 'blockquote', 'codeBlock'],
  };
  
  const isCompatible = compatibleTypes[sourceType]?.includes(targetType) || false;
  
  // Логируем результат проверки совместимости
  logBlockTypeTest(
    isCompatible ? TestResult.SUCCESS : TestResult.FAILED,
    `Type compatibility check: ${sourceType} -> ${targetType}`,
    {
      sourceType,
      targetType,
      isCompatible,
      compatibleTypesForSource: compatibleTypes[sourceType] || [],
      allCompatibleTypes: Object.keys(compatibleTypes)
    }
  );
  
  return isCompatible;
};

// Функция для определения типа элемента
export const getElementType = (node: any): string => {
  return node.type.name;
};

// Функция для определения типа блока
export const getBlockType = (node: any): string => {
  return node.type.name;
};

// Функция для проверки, является ли узел блоком
export const isBlockNode = (node: any): boolean => {
  const blockTypes = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'table', 'blockquote', 'codeBlock'];
  return blockTypes.includes(node.type.name);
};

// Функция для проверки, является ли узел элементом
export const isElementNode = (node: any): boolean => {
  const elementTypes = ['listItem', 'taskItem', 'tableRow', 'tableCell'];
  return elementTypes.includes(node.type.name);
};

// Функция для получения визуальной позиции drop
export const getDropPosition = (
  event: DragEvent,
  element: HTMLElement
): 'before' | 'after' | 'inside' => {
  const rect = element.getBoundingClientRect();
  const y = event.clientY;
  const x = event.clientX;
  
  // Определяем, находится ли курсор в верхней или нижней трети элемента
  const topThird = rect.top + rect.height * 0.33;
  const bottomThird = rect.top + rect.height * 0.67;
  
  if (y < topThird) {
    return 'before';
  } else if (y > bottomThird) {
    return 'after';
  } else {
    return 'inside';
  }
};

// Функция для валидации drop зоны
export const validateDropZone = (
  sourceType: 'block' | 'element',
  sourceData: any,
  targetZone: HTMLElement
): {
  isValid: boolean;
  reason?: string;
  visualFeedback?: 'valid' | 'invalid' | 'warning';
} => {
  // Проверяем, что это действительно drop зона
  if (!targetZone.hasAttribute('data-drop-zone')) {
    return {
      isValid: false,
      reason: 'Not a valid drop zone',
      visualFeedback: 'invalid'
    };
  }

  // Проверяем тип drop зоны
  const dropZoneType = targetZone.getAttribute('data-drop-zone-type');
  
  if (sourceType === 'element' && dropZoneType === 'block') {
    return {
      isValid: true,
      reason: 'Element can be moved to block',
      visualFeedback: 'valid'
    };
  }
  
  if (sourceType === 'block' && dropZoneType === 'block') {
    return {
      isValid: true,
      reason: 'Block can be moved to block',
      visualFeedback: 'valid'
    };
  }

  return {
    isValid: false,
    reason: 'Incompatible drop zone type',
    visualFeedback: 'invalid'
  };
};

// Функция для поиска ближайшей drop зоны
export const findNearestDropZone = (event: DragEvent): HTMLElement | null => {
  const target = event.target as HTMLElement;
  
  // Ищем ближайшую drop зону
  const dropZone = target.closest('[data-drop-zone]');
  
  if (dropZone) {
    return dropZone as HTMLElement;
  }
  
  // Если не нашли, ищем ближайший блок
  const block = target.closest('[data-block-id]');
  if (block) {
    return block as HTMLElement;
  }
  
  return null;
};

// Функция для определения типа drop зоны
export const getDropZoneType = (element: HTMLElement): 'block' | 'element' | 'unknown' => {
  const dropZoneType = element.getAttribute('data-drop-zone-type');
  
  if (dropZoneType === 'block' || dropZoneType === 'element') {
    return dropZoneType;
  }
  
  // Определяем по содержимому элемента
  if (element.querySelector('li, tr, .list-item, .table-row')) {
    return 'element';
  }
  
  if (element.hasAttribute('data-block-id')) {
    return 'block';
  }
  
  return 'unknown';
};

// Функция для создания ghost элемента
export const createGhostElement = (
  originalElement: HTMLElement,
  type: 'block' | 'element'
): HTMLElement => {
  const ghost = originalElement.cloneNode(true) as HTMLElement;
  
  // Базовые стили для ghost
  ghost.style.opacity = '0.8';
  ghost.style.position = 'fixed';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '10000';
  ghost.style.transform = 'rotate(2deg) scale(0.95)';
  ghost.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.12)';
  ghost.style.borderRadius = '8px';
  ghost.style.backgroundColor = 'white';
  ghost.style.border = '1px solid #e1e5e9';
  
  // Дополнительные стили в зависимости от типа
  if (type === 'element') {
    ghost.style.transform = 'rotate(1deg) scale(0.9)';
    ghost.style.opacity = '0.6';
  }
  
  return ghost;
};

// Функция для обновления позиции ghost элемента
export const updateGhostPosition = (
  ghost: HTMLElement,
  event: DragEvent,
  initialRect: DOMRect
): void => {
  const offsetX = event.clientX - initialRect.left;
  const offsetY = event.clientY - initialRect.top;
  
  ghost.style.left = `${initialRect.left + offsetX}px`;
  ghost.style.top = `${initialRect.top + offsetY}px`;
};

// Проверяет, является ли блок одноэлементным (содержит только один параграф или заголовок)
export const isSingleElementBlock = (block: any): boolean => {
  if (!block || !block.content) return false;

  const singleElementTypes = ['paragraph', 'heading'];
  if (singleElementTypes.includes(block.blockType)) {
    return true;
  }

  if (block.content && typeof block.content === 'object') {
    if (block.content.type === 'doc' && block.content.content) {
      const contentElements = block.content.content.filter((node: any) =>
        node.type === 'paragraph' || node.type === 'heading'
      );
      return contentElements.length === 1;
    }

    if (block.content.type === 'paragraph' || block.content.type === 'heading') {
      return true;
    }
  }
  return false;
};

// Извлекает содержимое одноэлементного блока
export const extractSingleElementContent = (block: any): any => {
  if (!block || !block.content) return null;

  if (block.content && typeof block.content === 'object') {
    if (block.content.type === 'doc' && block.content.content) {
      const contentElements = block.content.content.filter((node: any) =>
        node.type === 'paragraph' || node.type === 'heading'
      );
      return contentElements.length === 1 ? contentElements[0] : null;
    }

    if (block.content.type === 'paragraph' || block.content.type === 'heading') {
      return block.content;
    }
  }
  return null;
};
