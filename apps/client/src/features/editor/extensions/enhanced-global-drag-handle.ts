import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface GlobalDragHandleOptions {
  // Опции для настройки drag handle
}

export const EnhancedGlobalDragHandle = Extension.create<GlobalDragHandleOptions>({
  name: 'enhancedGlobalDragHandle',

  addOptions() {
    return {
      // Опции по умолчанию
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('enhancedGlobalDragHandle'),
        props: {
          handleDOMEvents: {
            dragstart: (view, event) => {
              const target = event.target as HTMLElement;
              const dragHandle = target.closest('[data-global-drag-handle="true"]');
              
              if (dragHandle) {
                const blockId = dragHandle.getAttribute('data-block-id');
                console.log('[EnhancedGlobalDragHandle] Block drag start:', blockId);
                console.log('[EnhancedGlobalDragHandle] Drag handle element:', dragHandle);
                console.log('[EnhancedGlobalDragHandle] Event target:', target);
                handleBlockDragStart(view, blockId, event);
                return true;
              }
              
              return false;
            },
            dragover: (view, event) => {
              const target = event.target as HTMLElement;
              const blockId = target.getAttribute('data-block-id');
              
              if (blockId) {
                handleBlockDragOver(view, blockId, event);
                return true;
              }
              
              return false;
            },
            dragleave: (view, event) => {
              const target = event.target as HTMLElement;
              const blockId = target.getAttribute('data-block-id');
              
              if (blockId) {
                handleBlockDragLeave(view, blockId, event);
                return true;
              }
              
              return false;
            },
            drop: (view, event) => {
              const target = event.target as HTMLElement;
              const blockId = target.getAttribute('data-block-id');
              
              if (blockId) {
                console.log('[EnhancedGlobalDragHandle] Block drop:', blockId);
                handleBlockDrop(view, blockId, event);
                return true;
              }
              
              return false;
            }
          }
        }
      })
    ];
  }
});

// Функция для обработки начала drag операции блока
function handleBlockDragStart(view: any, blockId: string, event: DragEvent) {
  const { state } = view;
  
  // Находим позицию блока в документе
  const blockPos = findBlockPosition(state.doc, blockId);
  if (blockPos === -1) return;
  
  // Устанавливаем данные для drag
  event.dataTransfer?.setData('application/block', blockId);
  event.dataTransfer?.setData('text/plain', `block:${blockId}`);
  event.dataTransfer!.effectAllowed = 'move';
  
  console.log('[EnhancedGlobalDragHandle] Block drag started:', {
    blockId,
    position: blockPos
  });
}

// Функция для обработки drag over блока
function handleBlockDragOver(view: any, blockId: string, event: DragEvent) {
  const target = event.target as HTMLElement;
  const dropZone = target.closest('[data-block-drop-zone]');
  
  if (dropZone) {
    // Показываем индикатор вставки
    showInsertIndicator(event, dropZone as HTMLElement);
  }
}

// Функция для обработки drag leave блока
function handleBlockDragLeave(view: any, blockId: string, event: DragEvent) {
  // Скрываем индикатор вставки
  hideInsertIndicator();
}

// Функция для показа индикатора вставки
function showInsertIndicator(event: DragEvent, dropZone: HTMLElement) {
  // Убираем предыдущий индикатор
  hideInsertIndicator();
  
  const rect = dropZone.getBoundingClientRect();
  const y = event.clientY;
  
  // Определяем, вставлять ли в начало или конец зоны
  const isInsertAtEnd = y > rect.top + rect.height / 2;
  
  // Создаем индикатор
  const indicator = document.createElement('div');
  indicator.className = 'insert-indicator';
  indicator.style.cssText = `
    position: absolute;
    left: ${rect.left}px;
    top: ${isInsertAtEnd ? rect.bottom - 2 : rect.top - 2}px;
    width: ${rect.width}px;
    height: 4px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 2px;
    z-index: 9999;
    pointer-events: none;
    transition: all 0.2s ease;
  `;

  document.body.appendChild(indicator);
}

// Функция для скрытия индикатора вставки
function hideInsertIndicator() {
  const indicator = document.querySelector('.insert-indicator');
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }
}

// Метод для обработки drop операции блока
function handleBlockDrop(view: any, blockId: string, event: DragEvent) {
  const { state, dispatch } = view;
  const target = event.target as HTMLElement;

  // Находим исходный блок
  const sourcePos = findBlockPosition(state.doc, blockId);
  if (sourcePos === -1) return;

  // Определяем тип блока
  const sourceNode = state.doc.nodeAt(sourcePos);
  if (!sourceNode) return;

  // Находим целевую позицию
  const targetPos = findBlockDropPosition(state.doc, event);
  if (targetPos === -1) return;

  // Создаем transaction для перемещения
  const tr = state.tr;

  // Удаляем блок из исходной позиции
  tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);

  // Вставляем блок в целевую позицию
  tr.insert(targetPos, sourceNode);

  // Применяем изменения
  dispatch(tr);
}

// Вспомогательные функции для работы с блоками
function findBlockPosition(doc: any, blockId: string): number {
  let pos = -1;

  doc.descendants((node: any, nodePos: number) => {
    if (node.attrs.id === blockId) {
      pos = nodePos;
      return false;
    }
  });

  return pos;
}

function findBlockDropPosition(doc: any, event: DragEvent): number {
  const target = event.target as HTMLElement;
  const dropZone = target.closest('[data-block-drop-zone]');

  if (!dropZone) return -1;

  const rect = dropZone.getBoundingClientRect();
  const y = event.clientY;

  // Определяем, вставлять ли в начало или конец зоны
  const isInsertAtEnd = y > rect.top + rect.height / 2;

  // Находим позицию в документе
  const pos = findNodePosition(doc, dropZone);

  if (pos === -1) return -1;

  return isInsertAtEnd ? pos + 1 : pos;
}

function findNodePosition(doc: any, element: Element): number {
  let pos = -1;

  doc.descendants((node: any, nodePos: number) => {
    // Здесь должна быть логика сопоставления DOM элемента с узлом документа
    pos = nodePos;
    return false;
  });

  return pos;
}
