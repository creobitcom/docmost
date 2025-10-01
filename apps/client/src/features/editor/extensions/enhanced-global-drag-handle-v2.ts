import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { dndCoordinator } from "../dnd/DndCoordinator";

export interface EnhancedGlobalDragHandleV2Options {
  dragHandleWidth?: number;
  ignoreElements?: (element: HTMLElement) => boolean;
}

export const EnhancedGlobalDragHandleV2 = Extension.create<EnhancedGlobalDragHandleV2Options>({
  name: 'enhancedGlobalDragHandleV2',

  addOptions() {
    return {
      dragHandleWidth: 24,
      ignoreElements: () => false,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const pluginKey = new PluginKey('enhancedGlobalDragHandleV2');

    // Добавляем глобальный обработчик dragstart на уровне документа
    const globalDragStartHandler = (event: DragEvent) => {
      console.log('[EnhancedGlobalDragHandleV2] Global dragstart event intercepted');

      const target = event.target as HTMLElement;
      console.log('[EnhancedGlobalDragHandleV2] Target element:', target);
      console.log('[EnhancedGlobalDragHandleV2] Target classes:', target.className);
      console.log('[EnhancedGlobalDragHandleV2] Target attributes:', Array.from(target.attributes).map(attr => `${attr.name}="${attr.value}"`));

      // Игнорируем элементные drag-хэндлы в любом случае
      const isElementHandle = !!target.closest('[data-element-drag-handle], .element-drag-handle, .element-drag-handle-widget, .real-element-drag-handle-widget');
      if (isElementHandle) {
        console.log('[EnhancedGlobalDragHandleV2] Skipping global handler: element drag handle detected');
        return;
      }

      // Существенно сужаем: реагируем ТОЛЬКО когда источник — именно кнопка блокового handle
      const blockKnob = target.closest('.drag-handle') as HTMLElement | null;
      if (!blockKnob) {
        return;
      }
      const dragHandle = blockKnob.closest('[data-global-drag-handle="true"]') as HTMLElement | null;

      if (!dragHandle) {
        console.log('[EnhancedGlobalDragHandleV2] No drag handle found in global handler');
        return;
      }

      console.log('[EnhancedGlobalDragHandleV2] Drag handle found:', dragHandle);
      console.log('[EnhancedGlobalDragHandleV2] Drag handle classes:', dragHandle.className);
      console.log('[EnhancedGlobalDragHandleV2] Drag handle attributes:', Array.from(dragHandle.attributes).map(attr => `${attr.name}="${attr.value}"`));

      // Дополнительная защита уже не нужна (проверили выше)

      const blockId = dragHandle.getAttribute('data-block-id');
      if (!blockId) {
        console.log('[EnhancedGlobalDragHandleV2] No block ID found in global handler');
        return;
      }

      console.log('[EnhancedGlobalDragHandleV2] Block drag start for:', blockId);

      // Устанавливаем дополнительные данные для cross-block поддержки
      const dragBlockData = {
        type: 'block',
        blockId,
        blockType: 'paragraph', // Базовый тип, будет уточнен в drop
        nodeJSON: null,
        pos: 0,
        sourceBlockId: blockId
      };

      const blockDataJson = JSON.stringify(dragBlockData);

      // Устанавливаем данные в различных форматах
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/json', blockDataJson);
        event.dataTransfer.setData('text/plain', `block:${blockId}`);
      }

      console.log('[EnhancedGlobalDragHandleV2] Block drag data set in global handler:', dragBlockData);

      // Сохраняем данные в координаторе (без использования window.__dragState)
      dndCoordinator.start({
        type: 'block',
        sourceId: blockId,
        sourceBlockId: blockId,
        payload: { type: 'block', blockId },
        meta: { blockType: 'paragraph' }
      });
      // Безопасный window fallback (не конфликтует с __dragState)
      try {
        (window as any).docmostDragState = (window as any).docmostDragState || {};
        (window as any).docmostDragState.current = dragBlockData;
      } catch {}
    };

    // Добавляем глобальный обработчик
    document.addEventListener('dragstart', globalDragStartHandler, true);

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleDOMEvents: {
            // Перехватываем dragstart события для установки правильных данных
            dragstart: (view: EditorView, event: DragEvent) => {
              console.log('[EnhancedGlobalDragHandleV2] 🚀 DRAGSTART EVENT INTERCEPTED - NEW VERSION LOADED!');

              const target = event.target as HTMLElement;
              console.log('[EnhancedGlobalDragHandleV2] Target element:', target);
              console.log('[EnhancedGlobalDragHandleV2] Target classes:', target.className);
              console.log('[EnhancedGlobalDragHandleV2] Target attributes:', Array.from(target.attributes).map(attr => `${attr.name}="${attr.value}"`));

              // Отладка: проверим все возможные drag handles в DOM
              const allDragHandles = document.querySelectorAll('[data-element-drag-handle], .element-drag-handle, .element-drag-handle-widget, .real-element-drag-handle-widget, [data-global-drag-handle], .drag-handle');
              console.log('[EnhancedGlobalDragHandleV2] All drag handles in DOM:', allDragHandles.length, Array.from(allDragHandles).map(el => ({
                tag: el.tagName,
                classes: el.className,
                attrs: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`)
              })));

              // Отладка: проверим taskList элементы
              const taskLists = document.querySelectorAll('[data-type="taskList"], .task-list, ul, ol');
              console.log('[EnhancedGlobalDragHandleV2] Task lists found:', taskLists.length);
              taskLists.forEach((list, i) => {
                const listItems = list.querySelectorAll('li, [data-type="taskItem"], [data-type="listItem"]');
                console.log(`[EnhancedGlobalDragHandleV2] Task list ${i}:`, {
                  tag: list.tagName,
                  classes: list.className,
                  attrs: Array.from(list.attributes).map(attr => `${attr.name}="${attr.value}"`),
                  items: listItems.length,
                  itemAttrs: Array.from(listItems).map(item => Array.from(item.attributes).map(attr => `${attr.name}="${attr.value}"`))
                });
              });

              // Ветвь для элементного DnD: если тащим элементную ручку — выставляем элементный payload
              const elementHandle = target.closest('[data-element-drag-handle], .element-drag-handle, .element-drag-handle-widget, .real-element-drag-handle-widget');
              if (elementHandle) {
                console.log('[EnhancedGlobalDragHandleV2] Element drag handle found:', elementHandle);
                const blockRoot = (elementHandle as HTMLElement).closest('[data-block-id]') as HTMLElement | null;
                const sourceBlockId = blockRoot?.getAttribute('data-block-id') || undefined;
                // elementId: сначала из data-element-id, иначе ближайший внутренний data-block-id, отличный от корневого блока
                let elementId = (elementHandle as HTMLElement).closest('[data-element-id]')?.getAttribute('data-element-id') || undefined;
                if (!elementId && blockRoot) {
                  let ancestor: HTMLElement | null = elementHandle as HTMLElement;
                  while (ancestor && ancestor !== blockRoot) {
                    if (ancestor.hasAttribute('data-block-id')) {
                      const innerId = ancestor.getAttribute('data-block-id');
                      if (innerId && innerId !== sourceBlockId) { elementId = innerId; break; }
                    }
                    ancestor = ancestor.parentElement;
                  }
                }
                if (!elementId || !sourceBlockId) {
                  console.log('[EnhancedGlobalDragHandleV2] Element drag detected but ids missing');
                  return false;
                }
                const elementPayload = { type: 'element', sourceBlockId, elementId };
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('application/element', JSON.stringify(elementPayload));
                  event.dataTransfer.setData('text/plain', `element:${elementId}`);
                }
                dndCoordinator.start({
                  type: 'element',
                  sourceId: elementId,
                  sourceBlockId: sourceBlockId,
                  payload: { type: 'element', elementId, sourceBlockId },
                });
                console.log('[EnhancedGlobalDragHandleV2] Element drag data set:', elementPayload);
                return false;
              }

              // Fallback: если элементные handles не найдены, попробуем определить элементный drag по содержимому
              const listItem = target.closest('li, [data-type="taskItem"], [data-type="listItem"]');
              if (listItem) {
                console.log('[EnhancedGlobalDragHandleV2] List item detected, checking for element drag:', listItem);
                const blockRoot = (listItem as HTMLElement).closest('[data-block-id]') as HTMLElement | null;
                const sourceBlockId = blockRoot?.getAttribute('data-block-id') || undefined;

                // Ищем elementId в атрибутах listItem
                let elementId = (listItem as HTMLElement).getAttribute('data-block-id') ||
                               (listItem as HTMLElement).getAttribute('data-element-id') ||
                               (listItem as HTMLElement).getAttribute('blockid') ||
                               (listItem as HTMLElement).getAttribute('blockId');

                if (elementId && sourceBlockId && elementId !== sourceBlockId) {
                  console.log('[EnhancedGlobalDragHandleV2] Element drag detected via list item:', { elementId, sourceBlockId });
                  const elementPayload = { type: 'element', sourceBlockId, elementId };
                  if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('application/element', JSON.stringify(elementPayload));
                    event.dataTransfer.setData('text/plain', `element:${elementId}`);
                  }
                  dndCoordinator.start({
                    type: 'element',
                    sourceId: elementId,
                    sourceBlockId: sourceBlockId,
                    payload: { type: 'element', elementId, sourceBlockId },
                  });
                  console.log('[EnhancedGlobalDragHandleV2] Element drag data set via fallback:', elementPayload);
                  return false;
                }
              }

              // Существенно сужаем: реагируем ТОЛЬКО когда источник — именно кнопка блокового handle
              const blockKnob = target.closest('.drag-handle') as HTMLElement | null;
              if (!blockKnob) {
                return false;
              }
              const dragHandle = blockKnob.closest('[data-global-drag-handle="true"]') as HTMLElement | null;

              if (!dragHandle) {
                console.log('[EnhancedGlobalDragHandleV2] No drag handle found, letting default handler work');
                return false;
              }

              console.log('[EnhancedGlobalDragHandleV2] Drag handle found:', dragHandle);
              console.log('[EnhancedGlobalDragHandleV2] Drag handle classes:', dragHandle.className);
              console.log('[EnhancedGlobalDragHandleV2] Drag handle attributes:', Array.from(dragHandle.attributes).map(attr => `${attr.name}="${attr.value}"`));

              // Элементный drag уже отфильтрован выше

              const blockId = dragHandle.getAttribute('data-block-id');
              if (!blockId) {
                console.log('[EnhancedGlobalDragHandleV2] No block ID found, letting default handler work');
                return false;
              }

              console.log('[EnhancedGlobalDragHandleV2] Block drag start for:', blockId);

              // Получаем информацию о блоке из ProseMirror
              const coords = { left: event.clientX, top: event.clientY };
              const pos = view.posAtCoords(coords);
              if (!pos) {
                console.log('[EnhancedGlobalDragHandleV2] No position found, letting default handler work');
                return false;
              }

              const $pos = view.state.doc.resolve(pos.pos);
              const node = $pos.nodeAfter;
              if (!node) {
                console.log('[EnhancedGlobalDragHandleV2] No node found, letting default handler work');
                return false;
              }

              // Устанавливаем дополнительные данные для cross-block поддержки
              const dragBlockData = {
                type: 'block',
                blockId,
                blockType: node.type.name,
                nodeJSON: node.toJSON(),
                pos: pos.pos,
                sourceBlockId: blockId
              };

              const blockDataJson = JSON.stringify(dragBlockData);

              // Устанавливаем данные в различных форматах
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('application/json', blockDataJson);
                event.dataTransfer.setData('text/plain', `block:${blockId}`);
              }

              console.log('[EnhancedGlobalDragHandleV2] Block drag data set:', dragBlockData);

              // Сохраняем данные в координаторе (без использования window.__dragState)
              dndCoordinator.start({
                type: 'block',
                sourceId: blockId,
                sourceBlockId: blockId,
                payload: { type: 'block', blockId },
                meta: { blockType: node.type.name, pos: pos.pos }
              });
              // Безопасный window fallback (не конфликтует с __dragState)
              try {
                (window as any).docmostDragState = (window as any).docmostDragState || {};
                (window as any).docmostDragState.current = dragBlockData;
              } catch {}

              return false; // Позволяем стандартному обработчику продолжить
            },

            // Перехватываем drop события для добавления cross-block поддержки
            drop: (view: EditorView, event: DragEvent) => {
              console.log('[EnhancedGlobalDragHandleV2] Drop event intercepted');

              // Проверяем все возможные источники данных drag
              const jsonData = event.dataTransfer?.getData('application/json');
              const prosemirrorData = event.dataTransfer?.getData('application/x-prosemirror-node');
              const prosemirrorPos = event.dataTransfer?.getData('application/x-prosemirror-pos');
              const blockDataString = event.dataTransfer?.getData('application/block');
              const textData = event.dataTransfer?.getData('text/plain');

              console.log('[EnhancedGlobalDragHandleV2] Available drag data:', {
                jsonData,
                prosemirrorData,
                prosemirrorPos,
                blockDataString,
                textData,
                types: event.dataTransfer?.types
              });

              // Проверяем, что это drag элемента (не блок)
              const elementJson = event.dataTransfer?.getData('application/element');
              const isElementDrag = !!(
                elementJson ||
                event.dataTransfer?.getData('application/x-element-id') ||
                textData?.startsWith('element:') ||
                dndCoordinator.isElementDrag()
              );

              if (isElementDrag) {
                // Обрабатываем элементный drop самостоятельно, чтобы не было копирования от Tiptap
                event.preventDefault();
                event.stopPropagation();

                let sourceBlockId: string | undefined;
                let elementId: string | undefined;

                if (elementJson) {
                  try {
                    const parsed = JSON.parse(elementJson);
                    sourceBlockId = parsed.sourceBlockId;
                    elementId = parsed.elementId;
                  } catch {}
                }
                if (!elementId && textData?.startsWith('element:')) {
                  elementId = textData.replace('element:', '');
                }
                if (!sourceBlockId || !elementId) {
                  // fallback на координатор
                  const st = dndCoordinator.getState?.();
                  if (st?.type === 'element' && st.payload?.type === 'element') {
                    sourceBlockId = (st.payload as any).sourceBlockId;
                    elementId = (st.payload as any).elementId;
                  }
                }

                const target = event.target as HTMLElement;
                const targetBlockEl = target.closest('[data-block-id]') as HTMLElement | null;
                const targetBlockId = targetBlockEl?.getAttribute('data-block-id') || undefined;
                // targetElementId: сначала data-element-id, иначе ближайший внутренний data-block-id, отличный от корневого target блока
                let targetElementId = (target as HTMLElement).closest('[data-element-id]')?.getAttribute('data-element-id') || undefined;
                if (!targetElementId && targetBlockEl) {
                  let ancestor: HTMLElement | null = target as HTMLElement;
                  while (ancestor && ancestor !== targetBlockEl) {
                    if (ancestor.hasAttribute('data-block-id')) {
                      const innerId = ancestor.getAttribute('data-block-id');
                      if (innerId && innerId !== targetBlockId) { targetElementId = innerId; break; }
                    }
                    ancestor = ancestor.parentElement;
                  }
                }

                // Вычисляем before/after относительно targetElementEl
                let targetPosition: 'before' | 'after' | 'inside' = 'after';
                if (targetElementId) {
                  const el = (target as HTMLElement).closest('[data-element-id]') as HTMLElement | null;
                  const rect = el?.getBoundingClientRect();
                  const midY = rect.top + rect.height / 2;
                  targetPosition = event.clientY < midY ? 'before' : 'after';
                }

                if (sourceBlockId && elementId && targetBlockId) {
                  // Извлекаем реальный контент элемента из исходного блока
                  let elementContent = null;
                  try {
                    // Находим исходный блок в DOM
                    const sourceBlockElement = document.querySelector(`[data-block-id="${sourceBlockId}"]`);
                    if (sourceBlockElement) {
                      // Находим элемент в исходном блоке
                      const sourceElement = sourceBlockElement.querySelector(`[data-element-id="${elementId}"]`);
                      if (sourceElement) {
                        // Извлекаем JSON контент из data-атрибута или из DOM
                        const contentAttr = sourceElement.getAttribute('data-content');
                        if (contentAttr) {
                          elementContent = JSON.parse(contentAttr);
                        } else {
                          // Fallback: создаем базовую структуру listItem
                          elementContent = {
                            type: 'listItem',
                            attrs: {
                              elementId: elementId,
                              blockId: sourceBlockId
                            },
                            content: [
                              {
                                type: 'paragraph',
                                content: [
                                  {
                                    type: 'text',
                                    text: 'Элемент списка'
                                  }
                                ]
                              }
                            ]
                          };
                        }
                      }
                    }
                  } catch (error) {
                    console.warn('⚠️ [EnhancedGlobalDragHandle] Failed to extract element content:', error);
                    // Fallback: создаем базовую структуру listItem
                    elementContent = {
                      type: 'listItem',
                      attrs: {
                        elementId: elementId,
                        blockId: sourceBlockId
                      },
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: 'Элемент списка'
                            }
                          ]
                        }
                      ]
                    };
                  }

                  const detail = {
                    sourceBlockId,
                    targetBlockId,
                    elementData: {
                      id: elementId,
                      type: 'listItem',
                      content: elementContent,
                      position: 0,
                      parentBlockId: sourceBlockId,
                    },
                    targetPosition,
                    targetElementId,
                    elementId,
                  } as any;

                  console.log('🔄 [EnhancedGlobalDragHandle] ===== DISPATCHING CROSS-BLOCK ELEMENT MOVE =====');
                  console.log('🔄 [EnhancedGlobalDragHandle] Event detail:', detail);
                  console.log('🔄 [EnhancedGlobalDragHandle] Creating and dispatching event...');
                  document.dispatchEvent(new CustomEvent('cross-block-element-move', { detail }));
                  console.log('✅ [EnhancedGlobalDragHandle] Cross-block element move event dispatched');
                  console.log('✅ [EnhancedGlobalDragHandle] ===== CROSS-BLOCK ELEMENT MOVE DISPATCHED =====');
                  // 🔵 STEP 4: Принудительная очистка координатора
                  dndCoordinator.forceCleanup();
                  return true;
                }

                console.log('[EnhancedGlobalDragHandleV2] Element drag detected but incomplete data');
                return true;
              }

              // Проверяем, что это drag блока
              let isBlockDrag = false;
              // application/json должен содержать type: 'block'
              if (jsonData) {
                try {
                  const parsed = JSON.parse(jsonData);
                  if (parsed && parsed.type === 'block') isBlockDrag = true;
                } catch {}
              }
              // text/plain метка block:<id>
              if (!isBlockDrag && textData && textData.startsWith('block:')) isBlockDrag = true;
              // application/block (совместимость)
              if (!isBlockDrag && blockDataString) isBlockDrag = true;
              // prosemirrorData только если есть attrs.blockId
              if (!isBlockDrag && prosemirrorData) {
                try {
                  const nodeData = JSON.parse(prosemirrorData);
                  if (nodeData?.attrs?.blockId) isBlockDrag = true;
                } catch {}
              }

              if (!isBlockDrag) {
                console.log('[EnhancedGlobalDragHandleV2] Not a block drag, letting default handler work');
                return false; // Позволяем стандартному обработчику работать
              }

              console.log('[EnhancedGlobalDragHandleV2] Block drag detected');

              // Получаем информацию о целевом блоке
              const target = event.target as HTMLElement;
              const targetBlockElement = target.closest('[data-block-id]');
              const targetBlockId = targetBlockElement?.getAttribute('data-block-id');
              const currentBlockId = (window as any).__currentBlockId;

              if (!targetBlockId || !currentBlockId) {
                console.log('[EnhancedGlobalDragHandleV2] Missing block IDs, letting default handler work');
                return false; // Позволяем стандартному обработчику работать
              }

              // Определяем sourceBlockId из различных источников данных
              let sourceBlockId: string | undefined;
              let blockData: any = null;

              // Пытаемся получить данные из JSON
              if (jsonData) {
                try {
                  const parsed = JSON.parse(jsonData);
                  sourceBlockId = parsed.sourceBlockId || parsed.blockId;
                  blockData = parsed;
                } catch (error) {
                  console.warn('[EnhancedGlobalDragHandleV2] Failed to parse JSON data:', error);
                }
              }

              // Пытаемся получить данные из ProseMirror формата
              if (!sourceBlockId && prosemirrorData) {
                try {
                  const nodeData = JSON.parse(prosemirrorData);
                  sourceBlockId = nodeData.attrs?.blockId;
                  blockData = {
                    type: 'block',
                    blockType: nodeData.type,
                    nodeJSON: nodeData,
                    pos: prosemirrorPos ? parseInt(prosemirrorPos) : 0
                  };
                } catch (error) {
                  console.warn('[EnhancedGlobalDragHandleV2] Failed to parse ProseMirror data:', error);
                }
              }

              // Пытаемся получить данные из block формата
              if (!sourceBlockId && blockDataString) {
                const blockIdFromData = blockDataString;
                sourceBlockId = blockIdFromData;
                blockData = {
                  type: 'block',
                  blockId: blockIdFromData,
                  blockType: 'paragraph'
                };
              }

              // Пытаемся получить данные из text формата
              if (!sourceBlockId && textData?.startsWith('block:')) {
                sourceBlockId = textData.replace('block:', '');
                blockData = {
                  type: 'block',
                  blockId: sourceBlockId,
                  blockType: 'paragraph'
                };
              }

              // Используем координатор / безопасный window fallback как резерв
              if (!sourceBlockId) {
                const coordBlockId = dndCoordinator.getBlockId?.() || undefined;
                if (coordBlockId) {
                  sourceBlockId = coordBlockId;
                  blockData = { type: 'block', blockId: sourceBlockId, blockType: 'paragraph' };
                } else {
                  const safeWin = (window as any).docmostDragState?.current;
                  if (safeWin && typeof safeWin === 'object' && safeWin.blockId) {
                    sourceBlockId = safeWin.blockId;
                    blockData = safeWin;
                  }
                }
              }

              if (!sourceBlockId) {
                console.log('[EnhancedGlobalDragHandleV2] No source block ID found, letting default handler work');
                return false; // Позволяем стандартному обработчику работать
              }

              // Проверяем, является ли это cross-block операцией
              const isCrossBlock = sourceBlockId !== targetBlockId;

              console.log('[EnhancedGlobalDragHandleV2] Drop analysis:', {
                sourceBlockId,
                targetBlockId,
                currentBlockId,
                isCrossBlock
              });

              if (isCrossBlock) {
                console.log('[EnhancedGlobalDragHandleV2] ✅ CROSS-BLOCK drop detected');

                // Предотвращаем стандартную обработку
                event.preventDefault();
                event.stopPropagation();

                // Создаем событие для cross-block перемещения
                const crossBlockEvent = new CustomEvent('cross-block-block-move', {
                  detail: {
                    sourceBlockId,
                    targetBlockId,
                    blockData: {
                      id: (blockData && typeof blockData === 'object' && blockData.blockId) || sourceBlockId,
                      type: (blockData && typeof blockData === 'object' && blockData.blockType) ||
                            (blockData && typeof blockData === 'object' && blockData.nodeJSON?.type) || 'paragraph',
                      content: (blockData && typeof blockData === 'object' && blockData.nodeJSON) || blockData,
                      position: (blockData && typeof blockData === 'object' && blockData.pos) || 0,
                      parentBlockId: sourceBlockId
                    },
                    targetPosition: 'after' // Можно улучшить определение позиции
                  }
                });

                console.log('[EnhancedGlobalDragHandleV2] Dispatching cross-block event:', crossBlockEvent.detail);
                document.dispatchEvent(crossBlockEvent);

                // 🔵 STEP 4: Принудительная очистка координатора
                dndCoordinator.forceCleanup();

                return true; // Предотвращаем дальнейшую обработку
              } else {
                console.log('[EnhancedGlobalDragHandleV2] Same-block drop, letting default handler work');
                // 🔵 STEP 4: Принудительная очистка координатора и для same-block
                dndCoordinator.forceCleanup();
                return false; // Позволяем стандартному обработчику работать
              }
            },
          },
        },
      }),
    ];
  },

  onDestroy() {
    // Очищаем глобальный обработчик при уничтожении плагина
    // Примечание: в реальном приложении нужно сохранить ссылку на обработчик
    // для правильной очистки, но для простоты оставляем как есть
  },
});
