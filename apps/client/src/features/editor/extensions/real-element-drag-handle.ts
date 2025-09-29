import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EditorView } from '@tiptap/pm/view';
import { Node as PMNode } from '@tiptap/pm/model';
import { dndCoordinator, DndPayload } from '../dnd/DndCoordinator';
import { clearDragOverCache } from '../utils/unified-drag-handlers';
import '../styles/real-element-drag-handle.css';

const DOCMOST_MIME = 'application/x-docmost-dnd';

interface DragPayload {
  type: 'element';
  elementId: string;
  sourceBlockId: string;
  nodeJSON: any;
  sourcePos: number;
  nodeSize: number;
}

interface ElementDragHandleOptions {
  // Options can be added here
}

// Utility function to find block position by blockId
function findBlockPos(state: any, blockId: string): number {
  let pos = 0;
  state.doc.descendants((node: PMNode, position: number) => {
    if (node.attrs?.blockId === blockId || node.attrs?.id === blockId) {
      pos = position;
      return false; // stop traversal
    }
    return true;
  });
  return pos;
}

// 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Добавляем CSS для правильного позиционирования
function ensurePositioningCSS() {
  const existingStyle = document.getElementById('real-element-drag-handle-positioning');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.id = 'real-element-drag-handle-positioning';
    style.textContent = `
      /* Обеспечиваем правильное позиционирование real element handles */
      .ProseMirror li > div {
        position: relative;
      }

      .real-element-drag-handle-widget {
        position: absolute !important;
        left: -4rem !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 1000 !important;
      }

      /* Унифицируем позиционирование всех типов списков под стиль taskList */
      .ProseMirror ul, .ProseMirror ol {
        padding-left: 0;
        margin-left: 0;
      }

      /* Применяем структуру taskList ко всем спискам */
      .ProseMirror li {
        position: relative;
        padding-left: 0;
        margin-left: 0;
      }

      /* Для всех li создаем div-обертку как в taskList */
      .ProseMirror li > div {
        padding-left: 2rem;
        position: relative;
      }

      /* Если div уже есть (как в taskList), не добавляем еще один */
      .ProseMirror li > div > div {
        padding-left: 0;
      }

    `;
    document.head.appendChild(style);
    console.log('[RealElementDragHandle] Added positioning CSS');
  }
}

// Helper to create drag handles
function createElementDecorations(doc: any): DecorationSet {
  // Обеспечиваем CSS для позиционирования
  ensurePositioningCSS();

  const decorations: Decoration[] = [];
  let handleIndex = 0;

  doc.descendants((node: any, pos: number) => {
    // Поддерживаем все типы списков
    if (node.type.name === 'listItem' || node.type.name === 'taskItem' ||
        node.type.name === 'list_item' || node.type.name === 'task_item' ||
        node.type.name === 'bulletListItem' || node.type.name === 'orderedListItem') {
      const elementId = `element-${pos}-${node.type.name}`;

      // Уменьшаем логирование для производительности
      // console.log('[RealElementDragHandle] Creating drag handle for:', {
      //   nodeType: node.type.name,
      //   pos,
      //   elementId,
      //   handleIndex,
      //   nodeContent: node.content ? node.content.size : 0
      // });

      // 🚀 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Размещаем widget внутри элемента
      let widgetPos = pos + 1; // Позиция ВНУТРИ элемента списка

      const decoration = Decoration.widget(widgetPos, (view, getPos) => {
        const handle = document.createElement('div');
        handle.className = 'real-element-drag-handle-widget tiptap-style';
        handle.draggable = true;
        handle.setAttribute('data-element-drag-handle', 'true');
        handle.setAttribute('data-element-id', elementId);
        handle.setAttribute('data-pos', pos.toString());

        // Используем SVG иконку как в стандартном Tiptap drag handle
        handle.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" style="fill: rgba(55, 53, 47, 0.4); width: 10px; height: 10px;">
            <path d="M3,2 C2.44771525,2 2,1.55228475 2,1 C2,0.44771525 2.44771525,0 3,0 C3.55228475,0 4,0.44771525 4,1 C4,1.55228475 3.55228475,2 3,2 Z M3,6 C2.44771525,6 2,5.55228475 2,5 C2,4.44771525 2.44771525,4 3,4 C3.55228475,4 4,4.44771525 4,5 C4,5.55228475 3.55228475,6 3,6 Z M3,10 C2.44771525,10 2,9.55228475 2,9 C2,8.44771525 2.44771525,8 3,8 C3.55228475,8 4,8.44771525 4,9 C4,9.55228475 3.55228475,10 3,10 Z M7,2 C6.44771525,2 6,1.55228475 6,1 C6,0.44771525 6.44771525,0 7,0 C7.55228475,0 8,0.44771525 8,1 C8,1.55228475 7.55228475,2 7,2 Z M7,6 C6.44771525,6 6,5.55228475 6,5 C6,4.44771525 6.44771525,4 7,4 C7.55228475,4 8,4.44771525 8,5 C8,5.55228475 7.55228475,6 7,6 Z M7,10 C6.44771525,10 6,9.55228475 6,9 C6,8.44771525 6.44771525,8 7,8 C7.55228475,8 8,8.44771525 8,9 C8,9.55228475 7.55228475,10 7,10 Z"></path>
          </svg>
        `;

        // Стили как у стандартного Tiptap drag handle, но всплывающие
        handle.style.cssText = `
          width: 1.2rem;
          height: 1.5rem;
          cursor: grab;
          background: transparent;
          border: none;
          border-radius: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          opacity: 0.3;
          transition: opacity 0.2s ease;
          pointer-events: auto;
          position: absolute;
          left: -4rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 1000;
        `;

        // Get block context
        const blockId = view.dom.closest('[data-block-id]')?.getAttribute('data-block-id') || 'unknown';

        // Добавляем обработчики для показа/скрытия хэндла при hover
        const listItem = handle.closest('li');
        if (listItem) {
          listItem.addEventListener('mouseenter', () => {
            handle.style.opacity = '1';
          });

          listItem.addEventListener('mouseleave', () => {
            handle.style.opacity = '0';
          });
        }

        // Drag start handler
        handle.addEventListener('dragstart', (event: DragEvent) => {
          console.log('[RealElementDragHandle] DRAGSTART on handle:', elementId);
          console.log('[RealElementDragHandle] Source block ID:', blockId);

          const currentPos = getPos ? getPos() : pos;
          const currentNode = view.state.doc.nodeAt(currentPos);

          if (!currentNode) {
            console.warn('[RealElementDragHandle] No node found at position:', currentPos);
            return;
          }

          // Find the list item node (parent of the paragraph)
          let listItemNode = currentNode;
          let listItemPos = currentPos;

          // If current node is a paragraph, find its parent list item
          if (currentNode.type.name === 'paragraph') {
            const $pos = view.state.doc.resolve(currentPos);
            // Go up the tree to find the list item
            for (let i = $pos.depth; i >= 0; i--) {
              const node = $pos.node(i);
              if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
                listItemNode = node;
                listItemPos = $pos.start(i);
                break;
              }
            }
          }

          console.log('[RealElementDragHandle] Current node type:', currentNode.type.name);
          console.log('[RealElementDragHandle] List item node type:', listItemNode.type.name);
          console.log('[RealElementDragHandle] List item position:', listItemPos);

          const payload: DragPayload = {
            type: 'element',
            elementId,
            sourceBlockId: blockId,
            nodeJSON: listItemNode.toJSON(),
            sourcePos: listItemPos,
            nodeSize: listItemNode.nodeSize
          };

          // Set data in multiple formats for compatibility
          const payloadJson = JSON.stringify(payload);
          event.dataTransfer?.setData(DOCMOST_MIME, payloadJson);
          event.dataTransfer?.setData('application/json', payloadJson);
          event.dataTransfer?.setData('text/plain', payloadJson);

          // Visual feedback
          handle.classList.add('dragging');
          document.body.classList.add('element-dragging');
          document.body.setAttribute('data-drag-type', 'element');

          // Update coordinator
          dndCoordinator.start({
            type: 'element',
            sourceId: payload.elementId,
            sourceBlockId: payload.sourceBlockId,
            payload
          });

          // Dispatch global drag start event
          console.log('🚀 [RealElementDragHandle] ===== DISPATCHING GLOBAL DRAG START =====');
          console.log('🚀 [RealElementDragHandle] Drag payload:', payload);
          const globalDragEvent = new CustomEvent('global-element-drag-start', {
            detail: payload
          });
          console.log('🚀 [RealElementDragHandle] Global drag start event created:', {
            type: globalDragEvent.type,
            detail: globalDragEvent.detail
          });
          document.dispatchEvent(globalDragEvent);
          console.log('✅ [RealElementDragHandle] Global drag start event dispatched');
          console.log('✅ [RealElementDragHandle] ===== GLOBAL DRAG START DISPATCHED =====');

          console.log('[RealElementDragHandle] Drag payload set:', payload);
        });

        // Drag end handler
        handle.addEventListener('dragend', (event: DragEvent) => {
          console.log('[RealElementDragHandle] DRAGEND on handle:', elementId);

          // Clean up visual feedback
          handle.classList.remove('dragging');
          document.body.classList.remove('element-dragging');
          document.body.removeAttribute('data-drag-type');

          // Remove placeholder
          removePlaceholder();

          // Update coordinator
          dndCoordinator.end();
          clearDragOverCache(); // 🔧 ИСПРАВЛЕНИЕ: Очищаем кэш dragover

          // Dispatch global drag end event
          console.log('🏁 [RealElementDragHandle] ===== DISPATCHING GLOBAL DRAG END =====');
          console.log('🏁 [RealElementDragHandle] Drag end payload:', { elementId, blockId });
          const globalDragEndEvent = new CustomEvent('global-element-drag-end', {
            detail: { elementId, blockId }
          });
          console.log('🏁 [RealElementDragHandle] Global drag end event created:', {
            type: globalDragEndEvent.type,
            detail: globalDragEndEvent.detail
          });
          document.dispatchEvent(globalDragEndEvent);
          console.log('✅ [RealElementDragHandle] Global drag end event dispatched');
          console.log('✅ [RealElementDragHandle] ===== GLOBAL DRAG END DISPATCHED =====');
        });

        console.log('[RealElementDragHandle] Widget created successfully for:', elementId);
        return handle;
      }, {
        // 🚀 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: side: -1 для размещения widget в начале внутренней позиции
        side: -1,
        key: `real-element-drag-handle-${widgetPos}`
      });

      decorations.push(decoration);
      handleIndex++;
    }
  });

  // Уменьшаем логирование для производительности
  // console.log('[RealElementDragHandle] Total decorations created:', decorations.length);
  return DecorationSet.create(doc, decorations);
}

// Placeholder management functions
function insertPlaceholder(view: EditorView, targetPos: number, isAfter: boolean = false) {
  removePlaceholder(); // Remove existing placeholder first

  const placeholder = document.createElement('div');
  placeholder.className = 'drag-placeholder';
  placeholder.setAttribute('data-drag-placeholder', 'true');
  placeholder.style.cssText = `
    height: 2px;
    background: #3b82f6;
    margin: 2px 0;
    border-radius: 1px;
    opacity: 0.8;
    pointer-events: none;
  `;

  // Find the target DOM element
  const targetDom = view.domAtPos(targetPos);
  const targetElement = targetDom.node.nodeType === Node.TEXT_NODE
    ? targetDom.node.parentElement
    : targetDom.node as HTMLElement;

  if (targetElement) {
    // Убеждаемся, что мы не вставляем placeholder в неподходящее место
    const parentList = targetElement.closest('ul, ol');
    if (parentList) {
      if (isAfter) {
        targetElement.after(placeholder);
      } else {
        targetElement.before(placeholder);
      }
    }
  }
}

function removePlaceholder() {
  document.querySelectorAll('[data-drag-placeholder]').forEach(el => el.remove());
}

export const RealElementDragHandle = Extension.create<ElementDragHandleOptions>({
  name: 'realElementDragHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('realElementDragHandle'),

        state: {
          init(config, state) {
            console.log('[RealElementDragHandle] Plugin initialized');
            return createElementDecorations(state.doc);
          },
          apply(tr, set) {
            set = set.map(tr.mapping, tr.doc);
            
            // Игнорируем транзакции от FlexibleDocument плагина
            if (tr.getMeta('flexibleDocument') === true) {
              return set;
            }
            
            // Оптимизация: пересоздаем декорации только при значительных изменениях
            if (tr.docChanged && (tr.steps.length > 0)) {
              // Проверяем, действительно ли нужно пересоздавать декорации
              const hasListChanges = tr.steps.some(step => {
                // Проверяем, затрагивает ли изменение списки
                return (step as any).jsonID === 'addMark' || (step as any).jsonID === 'removeMark' ||
                       (step as any).jsonID === 'replace' || (step as any).jsonID === 'replaceAround';
              });

              if (hasListChanges) {
                // Уменьшаем логирование для производительности
                // console.log('[RealElementDragHandle] Document changed, recreating decorations');
                return createElementDecorations(tr.doc);
              }
            }
            return set;
          }
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },

          handleDOMEvents: {
            dragover: (view: EditorView, event: DragEvent) => {
              event.preventDefault();

              const target = (event.target as HTMLElement).closest('[data-element-drag-handle="true"]');
              if (!target) return false;

              const pos = parseInt(target.getAttribute('data-pos') || '0');
              const rect = target.getBoundingClientRect();
              const isAfter = event.clientY > rect.top + rect.height / 2;

              insertPlaceholder(view, pos, isAfter);
              return true;
            },

            drop: (view: EditorView, event: DragEvent) => {
              event.preventDefault();
              event.stopPropagation();

              // Добавляем таймаут для предотвращения зависаний
              const dropTimeout = setTimeout(() => {
                console.warn('[RealElementDragHandle] Drop operation timed out, aborting');
                return false;
              }, 1000); // 1 секунда таймаут

              try {
                console.log('[RealElementDragHandle] ProseMirror drop event triggered');
                console.log('[RealElementDragHandle] DataTransfer types:', event.dataTransfer?.types);
                console.log('[RealElementDragHandle] DataTransfer items:', event.dataTransfer?.items);

              // Get payload from different sources
              const mimePayload = event.dataTransfer?.getData(DOCMOST_MIME);
              const jsonPayload = event.dataTransfer?.getData('application/json');
              const textPayload = event.dataTransfer?.getData('text/plain');

              console.log('[RealElementDragHandle] MIME payload:', mimePayload);
              console.log('[RealElementDragHandle] JSON payload:', jsonPayload);
              console.log('[RealElementDragHandle] Text payload:', textPayload);

              const raw = mimePayload || jsonPayload || textPayload || '';
              let payload: DndPayload | null = null;

              try {
                payload = raw ? JSON.parse(raw) as DndPayload : null;
              } catch (err) {
                console.warn('[RealElementDragHandle] Failed to parse payload:', err);
              }

              if (!payload || payload.type !== 'element') {
                console.warn('[RealElementDragHandle] No valid element payload found in dataTransfer');

                // Try to get payload from global state
                const globalPayload = dndCoordinator.getCurrentPayload();
                if (globalPayload && globalPayload.type === 'element') {
                  console.log('[RealElementDragHandle] Using payload from global state:', globalPayload);
                  payload = globalPayload;
                } else {
                  console.warn('[RealElementDragHandle] No valid element payload found in global state either');
                  clearTimeout(dropTimeout);
                  return false;
                }
              }

              console.log('[RealElementDragHandle] Processing drop with payload:', payload);

              // Get target information - try multiple approaches
              let target = (event.target as HTMLElement).closest('[data-element-drag-handle="true"]');

              // If not found, try to find by coordinates
              if (!target) {
                console.log('[RealElementDragHandle] Target not found by closest, trying by coordinates');
                const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
                target = elementsAtPoint.find(el => el.hasAttribute('data-element-drag-handle')) as HTMLElement;
              }

              // If still not found, try to find any element drag handle in the current block
              if (!target) {
                console.log('[RealElementDragHandle] Target not found by coordinates, trying to find any handle in block');
                const currentBlock = view.dom.closest('[data-block-id]');
                if (currentBlock) {
                  target = currentBlock.querySelector('[data-element-drag-handle="true"]') as HTMLElement;
                }
              }

              // If still not found, try to find by looking for list items near the drop point
              if (!target) {
                console.log('[RealElementDragHandle] Target not found in block, trying to find list items near drop point');
                const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
                const listItem = elementsAtPoint.find(el =>
                  el.tagName === 'LI' ||
                  el.closest('li') ||
                  el.hasAttribute('data-checked') ||
                  el.closest('[data-checked]')
                ) as HTMLElement;

                if (listItem) {
                  // Find the drag handle for this list item
                  const li = listItem.tagName === 'LI' ? listItem : listItem.closest('li');
                  if (li) {
                    target = li.querySelector('[data-element-drag-handle="true"]') as HTMLElement;
                    console.log('[RealElementDragHandle] Found target by list item:', target);
                  }
                }
              }

              if (!target) {
                console.warn('[RealElementDragHandle] No valid drop target found');
                console.log('[RealElementDragHandle] Event target:', event.target);
                console.log('[RealElementDragHandle] Elements at point:', document.elementsFromPoint(event.clientX, event.clientY));
                clearTimeout(dropTimeout);
                return false;
              }

              const targetPos = parseInt(target.getAttribute('data-pos') || '0');
              const targetBlockId = view.dom.closest('[data-block-id]')?.getAttribute('data-block-id') || 'unknown';

              console.log('[RealElementDragHandle] Found target:', target);
              console.log('[RealElementDragHandle] Target pos:', targetPos);
              console.log('[RealElementDragHandle] Target block ID:', targetBlockId);

              const rect = target.getBoundingClientRect();
              const isAfter = event.clientY > rect.top + rect.height / 2;
              const finalTargetPos = isAfter ? targetPos + 1 : targetPos;

              // Extract source position from nested payload
              const sourcePos = payload.payload?.sourcePos;

              console.log('[RealElementDragHandle] Drop details:', {
                sourcePos: sourcePos,
                targetPos: finalTargetPos,
                sourceBlockId: payload.sourceBlockId,
                targetBlockId,
                isAfter,
                payloadType: payload.type,
                sourceId: payload.sourceId
              });

              // Дополнительная отладочная информация
              console.log('[RealElementDragHandle] Document structure analysis:', {
                docSize: view.state.doc.content.size,
                sourceNode: sourcePos ? view.state.doc.nodeAt(sourcePos) : null,
                targetNode: view.state.doc.nodeAt(finalTargetPos)
              });

              // Determine operation type
              const isCrossBlock = payload.sourceBlockId !== targetBlockId;
              const isIntraList = payload.sourceBlockId === targetBlockId;

              if (isIntraList) {
                console.log('[RealElementDragHandle] 🔄 INTRA-LIST reorder detected');

                // Create ProseMirror transaction for intra-list reordering
                const tr = view.state.tr;
                const nodeJSON = payload.payload?.nodeJSON;
                const node = view.state.schema.nodeFromJSON(nodeJSON);

                // Находим правильную позицию для вставки
                let insertPos: number;

                if (isAfter) {
                  // Вставляем после target элемента
                  const $targetPos = view.state.doc.resolve(targetPos);
                  let targetListItemPos = -1;

                  console.log('[RealElementDragHandle] Target position analysis:', {
                    targetPos,
                    depth: $targetPos.depth,
                    nodeTypes: Array.from({ length: $targetPos.depth + 1 }, (_, i) => ({
                      depth: i,
                      nodeType: $targetPos.node(i).type.name,
                      start: $targetPos.start(i),
                      end: $targetPos.end(i),
                      size: $targetPos.node(i).nodeSize
                    }))
                  });

                  // Находим позицию list item, содержащего target
                  // Сначала ищем taskItem на более глубоких уровнях
                  let foundTaskItem = false;
                  
                  // Проверяем все уровни от текущей глубины до 0
                  for (let i = $targetPos.depth; i >= 0; i--) {
                    const node = $targetPos.node(i);
                    console.log(`[RealElementDragHandle] Checking depth ${i}:`, {
                      nodeType: node.type.name,
                      start: $targetPos.start(i),
                      end: $targetPos.end(i),
                      size: node.nodeSize
                    });
                    
                    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
                      targetListItemPos = $targetPos.start(i) + node.nodeSize;
                      console.log('[RealElementDragHandle] Found list item at depth', i, 'position:', targetListItemPos);
                      foundTaskItem = true;
                      break;
                    }
                  }
                  
                  // Если не нашли taskItem, ищем его внутри taskList
                  if (!foundTaskItem) {
                    console.log('[RealElementDragHandle] No taskItem found at current depth, searching inside taskList');
                    
                    // Ищем taskItem внутри taskList
                    const taskListPos = $targetPos.pos;
                    const taskListNode = view.state.doc.nodeAt(taskListPos);
                    
                    if (taskListNode && (taskListNode.type.name === 'taskList' || taskListNode.type.name === 'bulletList' || taskListNode.type.name === 'orderedList')) {
                      console.log('[RealElementDragHandle] Found taskList, searching for taskItem inside');
                      console.log('[RealElementDragHandle] TaskList details (after):', {
                        pos: taskListPos,
                        childCount: taskListNode.childCount,
                        children: Array.from({ length: taskListNode.childCount }, (_, i) => ({
                          index: i,
                          type: taskListNode.child(i).type.name,
                          size: taskListNode.child(i).nodeSize
                        }))
                      });
                      
                      // Ищем taskItem внутри taskList, который ближе всего к targetPos
                      let closestItemPos = -1;
                      let minDistance = Infinity;
                      
                      taskListNode.forEach((node, offset) => {
                        if (node.type.name === 'taskItem' || node.type.name === 'listItem') {
                          const itemPos = taskListPos + offset + 1; // +1 для позиции после открывающего тега
                          const distance = Math.abs(itemPos - targetPos);
                          
                          console.log('[RealElementDragHandle] Found taskItem at position (after):', itemPos, 'distance from target:', distance);
                          
                          if (distance < minDistance) {
                            minDistance = distance;
                            closestItemPos = itemPos + node.nodeSize; // Для "after" добавляем размер узла
                          }
                        }
                      });
                      
                      if (closestItemPos !== -1) {
                        targetListItemPos = closestItemPos;
                        foundTaskItem = true;
                        console.log('[RealElementDragHandle] Using closest taskItem position (after):', targetListItemPos);
                      } else {
                        console.warn('[RealElementDragHandle] No taskItem found inside taskList (after)');
                      }
                    } else {
                      console.warn('[RealElementDragHandle] Target node is not a list (after):', taskListNode?.type.name);
                      
                      // Если targetPos указывает на taskItem, используем его позицию + размер для "after"
                      if (taskListNode && (taskListNode.type.name === 'taskItem' || taskListNode.type.name === 'listItem')) {
                        targetListItemPos = targetPos + taskListNode.nodeSize;
                        foundTaskItem = true;
                        console.log('[RealElementDragHandle] Using taskItem position + size for after:', targetListItemPos);
                      }
                    }
                  }

                  if (targetListItemPos === -1) {
                    console.warn('[RealElementDragHandle] Could not find target list item position, trying alternative approach');
                    
                    // Альтернативный подход: используем позицию target напрямую
                    // Если targetPos указывает на taskList, ищем ближайший taskItem
                    const targetNode = view.state.doc.nodeAt(targetPos);
                    if (targetNode && (targetNode.type.name === 'taskList' || targetNode.type.name === 'bulletList' || targetNode.type.name === 'orderedList')) {
                      console.log('[RealElementDragHandle] Target is a list, finding closest item position');
                      
                      // Ищем ближайший taskItem к targetPos
                      let closestItemPos = -1;
                      let minDistance = Infinity;
                      
                      targetNode.forEach((node, offset) => {
                        if (node.type.name === 'taskItem' || node.type.name === 'listItem') {
                          const itemPos = targetPos + offset + 1; // +1 для позиции после открывающего тега
                          const distance = Math.abs(itemPos - targetPos);
                          
                          if (distance < minDistance) {
                            minDistance = distance;
                            closestItemPos = itemPos;
                          }
                        }
                      });
                      
                      if (closestItemPos !== -1) {
                        targetListItemPos = closestItemPos;
                        console.log('[RealElementDragHandle] Using closest item position:', targetListItemPos);
                      } else {
                        console.warn('[RealElementDragHandle] No items found in target list');
                        clearTimeout(dropTimeout);
                        return false;
                      }
                    } else {
                      // Если targetPos не указывает на список, используем его напрямую
                      targetListItemPos = targetPos;
                      console.log('[RealElementDragHandle] Using target position directly:', targetListItemPos);
                    }
                    
                    if (targetListItemPos === -1) {
                      console.warn('[RealElementDragHandle] Could not find target list item position with alternative approach');
                      clearTimeout(dropTimeout);
                      return false;
                    }
                  }

                  insertPos = targetListItemPos;
                } else {
                  // Вставляем перед target элементом
                  const $targetPos = view.state.doc.resolve(targetPos);
                  let targetListItemPos = -1;

                  console.log('[RealElementDragHandle] Target position analysis (before):', {
                    targetPos,
                    depth: $targetPos.depth,
                    nodeTypes: Array.from({ length: $targetPos.depth + 1 }, (_, i) => ({
                      depth: i,
                      nodeType: $targetPos.node(i).type.name,
                      start: $targetPos.start(i),
                      end: $targetPos.end(i),
                      size: $targetPos.node(i).nodeSize
                    }))
                  });

                  // Находим позицию list item, содержащего target
                  // Сначала ищем taskItem на более глубоких уровнях
                  let foundTaskItem = false;
                  
                  // Проверяем все уровни от текущей глубины до 0
                  for (let i = $targetPos.depth; i >= 0; i--) {
                    const node = $targetPos.node(i);
                    console.log(`[RealElementDragHandle] Checking depth ${i} (before):`, {
                      nodeType: node.type.name,
                      start: $targetPos.start(i),
                      end: $targetPos.end(i),
                      size: node.nodeSize
                    });
                    
                    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
                      targetListItemPos = $targetPos.start(i);
                      console.log('[RealElementDragHandle] Found list item at depth', i, 'position (before):', targetListItemPos);
                      foundTaskItem = true;
                      break;
                    }
                  }
                  
                  // Если не нашли taskItem, ищем его внутри taskList
                  if (!foundTaskItem) {
                    console.log('[RealElementDragHandle] No taskItem found at current depth, searching inside taskList');
                    
                    // Ищем taskItem внутри taskList
                    const taskListPos = $targetPos.pos;
                    const taskListNode = view.state.doc.nodeAt(taskListPos);
                    
                    if (taskListNode && (taskListNode.type.name === 'taskList' || taskListNode.type.name === 'bulletList' || taskListNode.type.name === 'orderedList')) {
                      console.log('[RealElementDragHandle] Found taskList, searching for taskItem inside');
                      console.log('[RealElementDragHandle] TaskList details:', {
                        pos: taskListPos,
                        childCount: taskListNode.childCount,
                        children: Array.from({ length: taskListNode.childCount }, (_, i) => ({
                          index: i,
                          type: taskListNode.child(i).type.name,
                          size: taskListNode.child(i).nodeSize
                        }))
                      });
                      
                      // Ищем taskItem внутри taskList, который ближе всего к targetPos
                      let closestItemPos = -1;
                      let minDistance = Infinity;
                      
                      taskListNode.forEach((node, offset) => {
                        if (node.type.name === 'taskItem' || node.type.name === 'listItem') {
                          const itemPos = taskListPos + offset + 1; // +1 для позиции после открывающего тега
                          const distance = Math.abs(itemPos - targetPos);
                          
                          console.log('[RealElementDragHandle] Found taskItem at position:', itemPos, 'distance from target:', distance);
                          
                          if (distance < minDistance) {
                            minDistance = distance;
                            closestItemPos = itemPos;
                          }
                        }
                      });
                      
                      if (closestItemPos !== -1) {
                        targetListItemPos = closestItemPos;
                        foundTaskItem = true;
                        console.log('[RealElementDragHandle] Using closest taskItem position:', targetListItemPos);
                      } else {
                        console.warn('[RealElementDragHandle] No taskItem found inside taskList');
                      }
                    } else {
                      console.warn('[RealElementDragHandle] Target node is not a list:', taskListNode?.type.name);
                      
                      // Если targetPos указывает на taskItem, используем его позицию для "before"
                      if (taskListNode && (taskListNode.type.name === 'taskItem' || taskListNode.type.name === 'listItem')) {
                        targetListItemPos = targetPos;
                        foundTaskItem = true;
                        console.log('[RealElementDragHandle] Using taskItem position for before:', targetListItemPos);
                      }
                    }
                  }

                  if (targetListItemPos === -1) {
                    console.warn('[RealElementDragHandle] Could not find target list item position (before), trying alternative approach');
                    
                    // Альтернативный подход: используем позицию target напрямую
                    // Если targetPos указывает на taskList, ищем ближайший taskItem
                    const targetNode = view.state.doc.nodeAt(targetPos);
                    if (targetNode && (targetNode.type.name === 'taskList' || targetNode.type.name === 'bulletList' || targetNode.type.name === 'orderedList')) {
                      console.log('[RealElementDragHandle] Target is a list, finding closest item position (before)');
                      
                      // Ищем ближайший taskItem к targetPos
                      let closestItemPos = -1;
                      let minDistance = Infinity;
                      
                      targetNode.forEach((node, offset) => {
                        if (node.type.name === 'taskItem' || node.type.name === 'listItem') {
                          const itemPos = targetPos + offset + 1; // +1 для позиции после открывающего тега
                          const distance = Math.abs(itemPos - targetPos);
                          
                          if (distance < minDistance) {
                            minDistance = distance;
                            closestItemPos = itemPos;
                          }
                        }
                      });
                      
                      if (closestItemPos !== -1) {
                        targetListItemPos = closestItemPos;
                        console.log('[RealElementDragHandle] Using closest item position (before):', targetListItemPos);
                      } else {
                        console.warn('[RealElementDragHandle] No items found in target list (before)');
                        clearTimeout(dropTimeout);
                        return false;
                      }
                    } else {
                      // Если targetPos не указывает на список, используем его напрямую
                      targetListItemPos = targetPos;
                      console.log('[RealElementDragHandle] Using target position directly (before):', targetListItemPos);
                    }
                    
                    if (targetListItemPos === -1) {
                      console.warn('[RealElementDragHandle] Could not find target list item position (before) with alternative approach');
                      clearTimeout(dropTimeout);
                      return false;
                    }
                  }

                  insertPos = targetListItemPos;
                }

                // Учитываем удаление source элемента при расчете позиции вставки
                let deletePos = sourcePos;
                let finalInsertPos = insertPos;
                const nodeSize = node.nodeSize;
                
                // Если удаляем элемент до позиции вставки, корректируем позицию
                if (deletePos < insertPos) {
                  finalInsertPos = insertPos - nodeSize;
                }

                // Дополнительная проверка: убеждаемся, что позиция вставки корректна
                // после удаления source элемента
                if (finalInsertPos < 0) {
                  console.warn('[RealElementDragHandle] Final insert position is negative, adjusting');
                  finalInsertPos = 0;
                }

                console.log('[RealElementDragHandle] Move details:', {
                  sourcePos: deletePos,
                  targetPos: finalInsertPos,
                  nodeSize: nodeSize,
                  isAfter,
                  originalTargetPos: targetPos,
                  correctedPosition: finalInsertPos
                });

                // Проверяем, что позиция вставки валидна
                if (finalInsertPos < 0 || finalInsertPos > view.state.doc.content.size) {
                  console.warn('[RealElementDragHandle] Invalid insert position:', finalInsertPos);
                  clearTimeout(dropTimeout);
                  return false;
                }

                // Perform the move
                // Сначала удаляем элемент из исходной позиции
                tr.delete(deletePos, deletePos + nodeSize);

                // Проверяем, что узел для вставки не пустой
                if (!node || !node.content || node.content.size === 0) {
                  console.warn('[RealElementDragHandle] Node to insert is empty, skipping insertion');
                  clearTimeout(dropTimeout);
                  return false;
                }

                // Дополнительная проверка: узел должен содержать валидный контент
                let hasValidContent = false;
                node.content.forEach((child: any) => {
                  if (child.type.name === 'paragraph') {
                    if (child.content && child.content.size > 0) {
                      child.content.forEach((textNode: any) => {
                        if (textNode.type.name === 'text' && textNode.text && textNode.text.trim().length > 0) {
                          hasValidContent = true;
                        }
                      });
                    }
                  } else {
                    hasValidContent = true; // Не-параграфы считаем валидными
                  }
                });

                if (!hasValidContent) {
                  console.warn('[RealElementDragHandle] Node has no valid content, skipping insertion');
                  clearTimeout(dropTimeout);
                  return false;
                }

                // Проверяем, что позиция вставки находится внутри списка
                // Используем исходную позицию до удаления для проверки
                const $originalInsertPos = view.state.doc.resolve(insertPos);
                
                // Ищем родительский список на всех уровнях
                let listNode = null;
                let listDepth = -1;
                
                for (let i = $originalInsertPos.depth; i >= 0; i--) {
                  const node = $originalInsertPos.node(i);
                  if (['taskList', 'bulletList', 'orderedList'].includes(node.type.name)) {
                    listNode = node;
                    listDepth = i;
                    break;
                  }
                }
                
                console.log('[RealElementDragHandle] Insert position validation:', {
                  originalInsertPos: insertPos,
                  finalInsertPos: finalInsertPos,
                  listNodeType: listNode?.type.name,
                  listDepth: listDepth,
                  totalDepth: $originalInsertPos.depth,
                  allNodes: Array.from({ length: $originalInsertPos.depth + 1 }, (_, i) => ({
                    depth: i,
                    nodeType: $originalInsertPos.node(i).type.name,
                    start: $originalInsertPos.start(i),
                    end: $originalInsertPos.end(i)
                  }))
                });
                
                if (!listNode) {
                  console.warn('[RealElementDragHandle] Insert position is not inside a list, aborting');
                  clearTimeout(dropTimeout);
                  return false;
                }

                // Вставляем элемент в правильную позицию внутри списка
                try {
                  tr.insert(finalInsertPos, node);
                } catch (error) {
                  console.error('[RealElementDragHandle] Error inserting node:', error);
                  clearTimeout(dropTimeout);
                  return false;
                }

                // Очищаем пустые элементы после вставки
                // Собираем позиции пустых элементов для удаления
                const emptyPositions: { pos: number; size: number }[] = [];
                
                tr.doc.descendants((node, pos) => {
                  if (node.type.name === 'taskItem' || node.type.name === 'listItem') {
                    // Проверяем, пустой ли элемент списка
                    if (!node.content || node.content.size === 0) {
                      console.log('[RealElementDragHandle] Found empty list item at position:', pos);
                      emptyPositions.push({ pos, size: node.nodeSize });
                    } else {
                      // Дополнительная проверка: элемент содержит только пустые параграфы
                      let hasValidContent = false;
                      node.content.forEach((child: any) => {
                        if (child.type.name === 'paragraph') {
                          if (child.content && child.content.size > 0) {
                            child.content.forEach((textNode: any) => {
                              if (textNode.type.name === 'text' && textNode.text && textNode.text.trim().length > 0) {
                                hasValidContent = true;
                              }
                            });
                          }
                        } else {
                          hasValidContent = true;
                        }
                      });
                      
                      if (!hasValidContent) {
                        console.log('[RealElementDragHandle] Found list item with only empty paragraphs at position:', pos);
                        emptyPositions.push({ pos, size: node.nodeSize });
                      }
                    }
                  }
                });
                
                // Удаляем пустые элементы в обратном порядке (чтобы позиции не сбились)
                emptyPositions.reverse().forEach(({ pos, size }) => {
                  console.log('[RealElementDragHandle] Removing empty list item at position:', pos);
                  try {
                    tr.delete(pos, pos + size);
                  } catch (error) {
                    console.warn('[RealElementDragHandle] Error deleting empty item:', error);
                  }
                });

                view.dispatch(tr.scrollIntoView());
                console.log('[RealElementDragHandle] ✅ Intra-list move completed');

                // Дополнительная очистка пустых элементов через DOM
                setTimeout(() => {
                  // Ищем все возможные пустые элементы списка
                  const emptyListItems = view.dom.querySelectorAll('li.is-empty, li[data-placeholder], li:empty, li:not(:has(*))');
                  emptyListItems.forEach((item: Element) => {
                    console.log('[RealElementDragHandle] Removing empty DOM list item:', item);
                    item.remove();
                  });
                  
                  // Дополнительно ищем элементы списка, которые содержат только пустые параграфы
                  const allListItems = view.dom.querySelectorAll('li');
                  allListItems.forEach((item: Element) => {
                    const paragraphs = item.querySelectorAll('p');
                    if (paragraphs.length > 0) {
                      const hasTextContent = Array.from(paragraphs).some(p => 
                        p.textContent && p.textContent.trim().length > 0
                      );
                      if (!hasTextContent) {
                        console.log('[RealElementDragHandle] Removing list item with only empty paragraphs:', item);
                        item.remove();
                      }
                    }
                  });
                }, 100);

                // Убеждаемся, что placeholder удален после успешного drop
                removePlaceholder();

              } else if (isCrossBlock) {
                console.log('🔄 [RealElementDragHandle] ===== CROSS-BLOCK ELEMENT DROP DETECTED =====');
                console.log('🔄 [RealElementDragHandle] Source block ID:', payload.sourceBlockId);
                console.log('🔄 [RealElementDragHandle] Target block ID:', targetBlockId);
                console.log('🔄 [RealElementDragHandle] Element ID:', payload.sourceId); // Исправляем: используем sourceId
                console.log('🔄 [RealElementDragHandle] Source position:', sourcePos);
                console.log('🔄 [RealElementDragHandle] Is after:', isAfter);
                console.log('🔄 [RealElementDragHandle] Target position:', isAfter ? 'after' : 'before');
                console.log('🔄 [RealElementDragHandle] Node JSON:', payload.payload?.nodeJSON);

                // For cross-block, we'll use the existing cross-block event system
                // but also try to handle it through ProseMirror if possible
                const nodeJSON = payload.payload?.nodeJSON;
                if (nodeJSON && !nodeJSON.attrs?.elementId) {
                  // Добавляем elementId в атрибуты, если его нет
                  nodeJSON.attrs = { ...nodeJSON.attrs, elementId: payload.sourceId };
                }
                const node = view.state.schema.nodeFromJSON(nodeJSON);
                console.log('🔄 [RealElementDragHandle] Node created from JSON:', {
                  type: node.type.name,
                  attrs: node.attrs,
                  contentSize: node.content?.size || 0
                });

                // Определяем beforeElementId для правильной позиции вставки
                let beforeElementId: string | undefined;
                if (!isAfter) {
                  // Если вставляем "before", нужно найти элемент, перед которым вставляем
                  const targetNode = view.state.doc.nodeAt(targetPos);
                  if (targetNode && targetNode.attrs?.elementId) {
                    beforeElementId = targetNode.attrs.elementId;
                  } else {
                    // Ищем ближайший элемент с elementId
                    const $targetPos = view.state.doc.resolve(targetPos);
                    for (let i = $targetPos.depth; i >= 0; i--) {
                      const node = $targetPos.node(i);
                      if (node.attrs?.elementId) {
                        beforeElementId = node.attrs.elementId;
                        break;
                      }
                    }
                  }
                }

                const eventDetail = {
                  sourceBlockId: payload.sourceBlockId,
                  targetBlockId,
                  elementData: {
                    id: payload.sourceId, // Исправляем: используем sourceId вместо elementId
                    type: node.type.name,
                    content: nodeJSON, // Используем обновленный JSON с elementId
                    position: sourcePos,
                    parentBlockId: payload.sourceBlockId
                  },
                  targetPosition: isAfter ? 'after' : 'before',
                  elementId: payload.sourceId, // Исправляем: используем sourceId вместо elementId
                  beforeElementId: beforeElementId
                };

                console.log('🔄 [RealElementDragHandle] Creating cross-block event with detail:', eventDetail);
                const crossBlockEvent = new CustomEvent('cross-block-element-move', {
                  detail: eventDetail
                });

                console.log('🔄 [RealElementDragHandle] Event created:', {
                  type: crossBlockEvent.type,
                  detail: crossBlockEvent.detail,
                  bubbles: crossBlockEvent.bubbles,
                  cancelable: crossBlockEvent.cancelable
                });

                console.log('🔄 [RealElementDragHandle] Dispatching cross-block event...');
                document.dispatchEvent(crossBlockEvent);
                console.log('✅ [RealElementDragHandle] Cross-block event dispatched successfully');
                console.log('✅ [RealElementDragHandle] ===== CROSS-BLOCK ELEMENT DROP COMPLETED =====');
              }

              // Clean up
              removePlaceholder();
              clearTimeout(dropTimeout);
              return true;
              } catch (error) {
                console.error('[RealElementDragHandle] Error in drop handler:', error);
                clearTimeout(dropTimeout);
                removePlaceholder();
                return false;
              }
            }
          }
        }
      })
    ];
  }
});
