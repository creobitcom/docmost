/**
 * Утилита для исправления дублирующихся elementId в DOM
 */

/**
 * Исправляет дублирующиеся elementId в DOM
 * @param rootElement - корневой элемент для поиска (по умолчанию document)
 */
export function fixDuplicateElementIds(rootElement: Element | Document = document): void {
  console.log('🔧 [FixDuplicateElementIds] ===== FIXING DUPLICATE ELEMENT IDs =====');
  
  // Находим все элементы с data-element-id
  const allElements = rootElement.querySelectorAll('[data-element-id]');
  console.log('🔧 [FixDuplicateElementIds] Found elements with data-element-id:', allElements.length);
  
  // Группируем элементы по elementId
  const elementIdGroups = new Map<string, Element[]>();
  
  allElements.forEach(element => {
    const elementId = element.getAttribute('data-element-id');
    if (elementId) {
      if (!elementIdGroups.has(elementId)) {
        elementIdGroups.set(elementId, []);
      }
      elementIdGroups.get(elementId)!.push(element);
    }
  });
  
  console.log('🔧 [FixDuplicateElementIds] Element ID groups:', elementIdGroups.size);
  
  // Исправляем дублирующиеся ID
  let fixedCount = 0;
  elementIdGroups.forEach((elements, elementId) => {
    if (elements.length > 1) {
      console.warn('🔧 [FixDuplicateElementIds] Found duplicate elementId:', {
        elementId,
        count: elements.length,
        elements: elements.map(el => ({
          tagName: el.tagName,
          className: el.className,
          blockId: el.getAttribute('data-block-id')
        }))
      });
      
      // Оставляем первый элемент с оригинальным ID, остальным генерируем новые
      elements.slice(1).forEach((element, index) => {
        const newElementId = generateUniqueElementId(element);
        element.setAttribute('data-element-id', newElementId);
        
        // Также обновляем все дочерние элементы с этим ID
        const childElements = element.querySelectorAll(`[data-element-id="${elementId}"]`);
        childElements.forEach(child => {
          child.setAttribute('data-element-id', newElementId);
        });
        
        console.log('🔧 [FixDuplicateElementIds] Fixed duplicate elementId:', {
          oldId: elementId,
          newId: newElementId,
          element: {
            tagName: element.tagName,
            className: element.className,
            blockId: element.getAttribute('data-block-id')
          }
        });
        
        fixedCount++;
      });
    }
  });
  
  console.log('🔧 [FixDuplicateElementIds] Fixed duplicate elementIds:', fixedCount);
  console.log('✅ [FixDuplicateElementIds] ===== DUPLICATE ELEMENT ID FIXING COMPLETED =====');
}

/**
 * Генерирует уникальный elementId для элемента
 */
function generateUniqueElementId(element: Element): string {
  const blockId = element.getAttribute('data-block-id') || 'unknown';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  
  return `element-${blockId}-${timestamp}-${random}`;
}

/**
 * Проверяет наличие дублирующихся elementId в DOM
 */
export function checkForDuplicateElementIds(rootElement: Element | Document = document): {
  hasDuplicates: boolean;
  duplicates: Array<{
    elementId: string;
    count: number;
    elements: Element[];
  }>;
} {
  console.log('🔍 [CheckDuplicateElementIds] ===== CHECKING FOR DUPLICATE ELEMENT IDs =====');
  
  const allElements = rootElement.querySelectorAll('[data-element-id]');
  const elementIdGroups = new Map<string, Element[]>();
  
  allElements.forEach(element => {
    const elementId = element.getAttribute('data-element-id');
    if (elementId) {
      if (!elementIdGroups.has(elementId)) {
        elementIdGroups.set(elementId, []);
      }
      elementIdGroups.get(elementId)!.push(element);
    }
  });
  
  const duplicates = Array.from(elementIdGroups.entries())
    .filter(([_, elements]) => elements.length > 1)
    .map(([elementId, elements]) => ({
      elementId,
      count: elements.length,
      elements
    }));
  
  const hasDuplicates = duplicates.length > 0;
  
  console.log('🔍 [CheckDuplicateElementIds] Check results:', {
    hasDuplicates,
    duplicateCount: duplicates.length,
    totalElements: allElements.length,
    uniqueIds: elementIdGroups.size
  });
  
  if (hasDuplicates) {
    console.warn('🔍 [CheckDuplicateElementIds] Found duplicates:', duplicates.map(d => ({
      elementId: d.elementId,
      count: d.count
    })));
  }
  
  console.log('✅ [CheckDuplicateElementIds] ===== DUPLICATE ELEMENT ID CHECK COMPLETED =====');
  
  return {
    hasDuplicates,
    duplicates
  };
}

/**
 * Автоматически исправляет дублирующиеся elementId при обнаружении
 */
export function autoFixDuplicateElementIds(rootElement: Element | Document = document): void {
  const checkResult = checkForDuplicateElementIds(rootElement);
  
  if (checkResult.hasDuplicates) {
    console.log('🔧 [AutoFixDuplicateElementIds] Duplicates detected, fixing...');
    fixDuplicateElementIds(rootElement);
  } else {
    console.log('✅ [AutoFixDuplicateElementIds] No duplicates found');
  }
}

