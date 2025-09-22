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
        left: -60px !important;
        top: 2px !important;
        z-index: 1000 !important;
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
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
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
        handle.className = 'real-element-drag-handle-widget';
        handle.draggable = true;
        handle.setAttribute('data-element-drag-handle', 'true');
        handle.setAttribute('data-element-id', elementId);
        handle.setAttribute('data-pos', pos.toString());
        handle.innerHTML = '⋮⋮';
        
        // 🔧 УПРОЩЕНИЕ: CSS теперь применяется глобально, убираем дублирование
        handle.style.cssText = `
          width: 18px;
          height: 18px;
          cursor: grab;
          background: #3b82f6;
          border: 1px solid #1e40af;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: white;
          user-select: none;
          opacity: 0.8;
          transition: opacity 0.2s ease;
          pointer-events: auto;
          position: absolute;
          left: -60px;
          top: 2px;
          z-index: 1000;
        `;

        // Get block context
        const blockId = view.dom.closest('[data-block-id]')?.getAttribute('data-block-id') || 'unknown';

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
  
  // Find the target DOM element
  const targetDom = view.domAtPos(targetPos);
  const targetElement = targetDom.node.nodeType === Node.TEXT_NODE 
    ? targetDom.node.parentElement 
    : targetDom.node as HTMLElement;
  
  if (targetElement) {
    if (isAfter) {
      targetElement.after(placeholder);
    } else {
      targetElement.before(placeholder);
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
            if (tr.docChanged) {
              console.log('[RealElementDragHandle] Document changed, recreating decorations');
              return createElementDecorations(tr.doc);
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
                
                // Упрощенная логика: используем позицию target напрямую
                let insertPos = targetPos;
                
                // Если isAfter, то вставляем после target элемента
                if (isAfter) {
                  // Находим конец target list item
                  const $targetPos = view.state.doc.resolve(targetPos);
                  for (let i = $targetPos.depth; i >= 0; i--) {
                    const node = $targetPos.node(i);
                    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
                      insertPos = $targetPos.start(i) + node.nodeSize;
                      break;
                    }
                  }
                }
                
                // Учитываем удаление source элемента
                let deletePos = sourcePos;
                if (deletePos < insertPos) {
                  insertPos = insertPos - payload.payload?.nodeSize;
                }
                
                console.log('[RealElementDragHandle] Move details:', {
                  sourcePos: deletePos,
                  targetPos: insertPos,
                  nodeSize: payload.payload?.nodeSize,
                  isAfter
                });
                
                // Perform the move
                const nodeSize = payload.payload?.nodeSize;
                tr.delete(deletePos, deletePos + nodeSize);
                tr.insert(insertPos, node);
                
                view.dispatch(tr.scrollIntoView());
                console.log('[RealElementDragHandle] ✅ Intra-list move completed');
                
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
