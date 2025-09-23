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
      
      console.log('[RealElementDragHandle] Creating drag handle for:', {
        nodeType: node.type.name,
        pos,
        elementId,
        handleIndex,
        nodeContent: node.content ? node.content.size : 0
      });

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

  console.log('[RealElementDragHandle] Total decorations created:', decorations.length);
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
            // Оптимизация: пересоздаем декорации только при значительных изменениях
            if (tr.docChanged && (tr.steps.length > 0)) {
              // Проверяем, действительно ли нужно пересоздавать декорации
              const hasListChanges = tr.steps.some(step => {
                // Проверяем, затрагивает ли изменение списки
                return (step as any).jsonID === 'addMark' || (step as any).jsonID === 'removeMark' || 
                       (step as any).jsonID === 'replace' || (step as any).jsonID === 'replaceAround';
              });
              
              if (hasListChanges) {
                console.log('[RealElementDragHandle] Document changed, recreating decorations');
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
                isAfter
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
                  
                  // Находим позицию list item, содержащего target
                  for (let i = $targetPos.depth; i >= 0; i--) {
                    const node = $targetPos.node(i);
                    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
                      targetListItemPos = $targetPos.start(i) + node.nodeSize;
                      break;
                    }
                  }
                  
                  if (targetListItemPos === -1) {
                    console.warn('[RealElementDragHandle] Could not find target list item position');
                    return false;
                  }
                  
                  insertPos = targetListItemPos;
                } else {
                  // Вставляем перед target элементом
                  const $targetPos = view.state.doc.resolve(targetPos);
                  let targetListItemPos = -1;
                  
                  // Находим позицию list item, содержащего target
                  for (let i = $targetPos.depth; i >= 0; i--) {
                    const node = $targetPos.node(i);
                    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
                      targetListItemPos = $targetPos.start(i);
                      break;
                    }
                  }
                  
                  if (targetListItemPos === -1) {
                    console.warn('[RealElementDragHandle] Could not find target list item position');
                    return false;
                  }
                  
                  insertPos = targetListItemPos;
                }
                
                // Учитываем удаление source элемента при расчете позиции вставки
                let deletePos = sourcePos;
                if (deletePos < insertPos) {
                  // Если удаляем элемент до позиции вставки, корректируем позицию
                  insertPos = insertPos - payload.payload?.nodeSize;
                }
                
                console.log('[RealElementDragHandle] Move details:', {
                  sourcePos: deletePos,
                  targetPos: insertPos,
                  nodeSize: payload.payload?.nodeSize,
                  isAfter,
                  originalTargetPos: targetPos
                });
                
                // Perform the move
                const nodeSize = payload.payload?.nodeSize;
                
                // Сначала удаляем элемент из исходной позиции
                tr.delete(deletePos, deletePos + nodeSize);
                
                // Затем вставляем в новую позицию
                tr.insert(insertPos, node);
                
                view.dispatch(tr.scrollIntoView());
                console.log('[RealElementDragHandle] ✅ Intra-list move completed');
                
                // Убеждаемся, что placeholder удален после успешного drop
                removePlaceholder();
                
              } else if (isCrossBlock) {
                console.log('🔄 [RealElementDragHandle] ===== CROSS-BLOCK ELEMENT DROP DETECTED =====');
                console.log('🔄 [RealElementDragHandle] Source block ID:', payload.sourceBlockId);
                console.log('🔄 [RealElementDragHandle] Target block ID:', targetBlockId);
                console.log('🔄 [RealElementDragHandle] Element ID:', payload.elementId);
                console.log('🔄 [RealElementDragHandle] Source position:', sourcePos);
                console.log('🔄 [RealElementDragHandle] Is after:', isAfter);
                console.log('🔄 [RealElementDragHandle] Target position:', isAfter ? 'after' : 'before');
                console.log('🔄 [RealElementDragHandle] Node JSON:', payload.payload?.nodeJSON);
                
                // For cross-block, we'll use the existing cross-block event system
                // but also try to handle it through ProseMirror if possible
                const node = view.state.schema.nodeFromJSON(payload.payload?.nodeJSON);
                console.log('🔄 [RealElementDragHandle] Node created from JSON:', {
                  type: node.type.name,
                  attrs: node.attrs,
                  contentSize: node.content?.size || 0
                });
                
                const eventDetail = {
                  sourceBlockId: payload.sourceBlockId,
                  targetBlockId,
                  elementData: {
                    id: payload.elementId,
                    type: node.type.name,
                    content: payload.payload?.nodeJSON,
                    position: sourcePos,
                    parentBlockId: payload.sourceBlockId
                  },
                  targetPosition: isAfter ? 'after' : 'before',
                  elementId: payload.elementId
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
              return true;
            }
          }
        }
      })
    ];
  }
});
