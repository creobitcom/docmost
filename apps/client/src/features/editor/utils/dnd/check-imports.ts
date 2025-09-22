// Проверка импортов для drag and drop утилит
import { 
  moveElementBetweenBlocks, 
  validateDropZone, 
  findNearestDropZone, 
  getDropZoneType,
  isCompatibleElementType,
  getElementType,
  getBlockType,
  isBlockNode,
  isElementNode
} from '../drag-and-drop-utils';

// Проверяем, что все функции импортированы корректно
console.log('=== Проверка импортов DnD утилит ===');
console.log('moveElementBetweenBlocks:', typeof moveElementBetweenBlocks);
console.log('validateDropZone:', typeof validateDropZone);
console.log('findNearestDropZone:', typeof findNearestDropZone);
console.log('getDropZoneType:', typeof getDropZoneType);
console.log('isCompatibleElementType:', typeof isCompatibleElementType);
console.log('getElementType:', typeof getElementType);
console.log('getBlockType:', typeof getBlockType);
console.log('isBlockNode:', typeof isBlockNode);
console.log('isElementNode:', typeof isElementNode);

// Экспортируем для использования в других модулях
export {
  moveElementBetweenBlocks,
  validateDropZone,
  findNearestDropZone,
  getDropZoneType,
  isCompatibleElementType,
  getElementType,
  getBlockType,
  isBlockNode,
  isElementNode
};
