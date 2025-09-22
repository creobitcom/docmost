// Утилиты для работы с блоками
export * from './block-utils';

// Существующие утилиты
export * from './cross-block-element-utils';
// export * from './tiptap-yjs-move-utils';
// export { findInsertPosition, moveElementToPosition, InsertPosition } from './tiptap-yjs-move-utils';
// export * from './dnd-test-helper';
export * from './editor-diagnostics';

// Drag and drop утилиты (исключаем дублирующиеся функции)
export {
  moveBlock,
  moveElement,
  createBlockFromElement,
  // Исключаем moveElementBetweenBlocks и findElementPosition из-за дублирования
} from './drag-and-drop-utils';