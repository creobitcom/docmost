import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findChildren } from '@tiptap/core';

// Расширенный тип для DndPayload с поддержкой синтетических элементов
type ExtendedDndPayload = {
  type: 'element';
  elementId: string;
  sourceBlockId: string;
  synthetic?: boolean;
  textContent?: string;
};

// Тип для обычного DndPayload
type DndPayload = {
  type: 'element';
  elementId: string;
  sourceBlockId: string;
};

// Объединенный тип
type UnionDndPayload = DndPayload | ExtendedDndPayload;

const DOCMOST_MIME = 'application/docmost';

export const ElementDragHandle = Extension.create({
  name: 'elementDragHandle',

  addOptions() {
    return {
      dragHandleWidth: 20,
      dragHandleColor: '#e2e8f0',
      dragHandleHoverColor: '#cbd5e1',
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    
    // Создаем локальные функции для доступа к методам расширения
    const createElementDecorations = (doc: any) => (extension as any).createElementDecorations(doc);
    const findBlockIdForSelection = (view: any, selection: any) => (extension as any).findBlockIdForSelection(view, selection);
    const getBlockIdFromView = (view: any) => (extension as any).getBlockIdFromView(view);
    const isListItem = (doc: any, pos: number) => (extension as any).isListItem(doc, pos);
    const findElementById = (doc: any, elementId: string) => (extension as any).findElementById(doc, elementId);
    
    return [
      new Plugin({
        key: new PluginKey('elementDragHandle'),
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, decorationSet) => {
            // Обновляем декорации при изменении документа
            return createElementDecorations(tr.doc);
          },
        },
        props: {
          decorations: (state) => {
            return createElementDecorations(state.doc);
          },
          handleDOMEvents: {
            dragstart: (view, event) => {
              console.log('[ElementDragHandle] dragstart event triggered');
              const target = event.target as HTMLElement;
              
              if (target.classList.contains('element-drag-handle-widget')) {
                console.log('[ElementDragHandle] Widget dragstart detected');
                const elementId = target.getAttribute('data-element-id');
                const blockId = target.getAttribute('data-block-id');
                
                if (elementId && blockId) {
                  console.log('[ElementDragHandle] Widget dragstart - elementId:', elementId, 'blockId:', blockId);
                  
                  // Сохраняем исходный блок ID глобально
                  (window as any).__originalDragBlockId = blockId;
                  
                  const payload: DndPayload = {
                    type: 'element',
                    elementId,
                    sourceBlockId: blockId,
                  };
                  
                  event.dataTransfer?.setData(DOCMOST_MIME, JSON.stringify(payload));
                  console.log('[ElementDragHandle] Widget dragstart payload set:', payload);
                }
                return true;
              }
              
              // Обработка перетаскивания текста
              if (event.dataTransfer) {
                const selection = view.state.selection;
                const selectedText = view.state.doc.textBetween(selection.from, selection.to);
                
                if (selectedText.trim()) {
                  console.log('[ElementDragHandle] Text drag detected:', selectedText);
                  
                  // Находим блок, содержащий выделенный текст
                  const blockId = findBlockIdForSelection(view, selection);
                  if (blockId) {
                    console.log('[ElementDragHandle] Text drag from block:', blockId);
                    
                    // Сохраняем исходный блок ID глобально
                    (window as any).__originalDragBlockId = blockId;
                    
                    // Устанавливаем текст как обычные данные
                    event.dataTransfer.setData('text/plain', selectedText);
                    console.log('[ElementDragHandle] Text drag data set:', selectedText);
                  }
                }
              }
              
              return false;
            },
            drop: (view, event) => {
              console.log('[ElementDragHandle] ===== DROP HANDLER START =====');
              
              if (!event.dataTransfer) {
                console.log('[ElementDragHandle] No dataTransfer - aborting');
                return false;
              }

              const docMostData = event.dataTransfer.getData(DOCMOST_MIME);
              const textData = event.dataTransfer.getData('text/plain');
              
              console.log('[ElementDragHandle] DOCMOST_MIME data:', docMostData);
              console.log('[ElementDragHandle] text/plain data:', textData);
              console.log('[ElementDragHandle] __originalDragDoc:', (window as any).__originalDragDoc);
              console.log('[ElementDragHandle] __originalDragDocJSON:', (window as any).__originalDragDocJSON);
              console.log('[ElementDragHandle] __originalDragBlockId:', (window as any).__originalDragBlockId);

              let payload: UnionDndPayload | null = null;

              // Пытаемся парсить DOCMOST_MIME как JSON
              if (docMostData) {
                try {
                  payload = JSON.parse(docMostData) as DndPayload;
                  console.log('[ElementDragHandle] Successfully parsed DOCMOST_MIME payload:', payload);
                } catch (error) {
                  console.log('[ElementDragHandle] Failed to parse DOCMOST_MIME as JSON:', error);
                }
              }

              // Если DOCMOST_MIME не сработал, пытаемся использовать text/plain
              if (!payload && textData) {
                console.log('[ElementDragHandle] No valid DOCMOST_MIME payload, trying text/plain');
                
                // Проверяем, выглядит ли textData как JSON
                if (textData.trim().startsWith('{') && textData.trim().endsWith('}')) {
                  try {
                    payload = JSON.parse(textData) as DndPayload;
                    console.log('[ElementDragHandle] Successfully parsed text/plain as JSON payload:', payload);
                  } catch (error) {
                    console.log('[ElementDragHandle] Failed to parse text/plain as JSON:', error);
                  }
                } else {
                  console.log('[ElementDragHandle] Text payload is not JSON format, will use as fallback text:', textData);
                }
              }

              if (!payload) {
                console.log('[ElementDragHandle] No valid payload found in drop - aborting');
                return false;
              }

              // Получаем информацию о целевом блоке
              const targetBlockId = getBlockIdFromView(view);
              if (!targetBlockId) {
                console.log('[ElementDragHandle] No target block ID found - aborting');
                return false;
              }

              console.log('[ElementDragHandle] Target block ID:', targetBlockId);
              console.log('[ElementDragHandle] Payload:', payload);

              // Определяем тип операции
              const isCrossBlock = payload.sourceBlockId !== targetBlockId;
              const isIntraList = !isCrossBlock && isListItem(view.state.doc, view.state.selection.from);
              
              console.log('[ElementDragHandle] isCrossBlock:', isCrossBlock);
              console.log('[ElementDragHandle] isIntraList:', isIntraList);

              if (isCrossBlock) {
                console.log('[ElementDragHandle] Cross-block operation detected');
                
                // Проверяем, является ли это синтетическим элементом (перетаскивание текста)
                if (!payload.elementId || payload.elementId === 'synthetic') {
                  console.log('[ElementDragHandle] Synthetic element creation detected');
                  
                  // Создаем синтетический payload
                  const syntheticPayload: ExtendedDndPayload = {
                    type: 'element',
                    elementId: 'synthetic',
                    sourceBlockId: (window as any).__originalDragBlockId || payload.sourceBlockId,
                    synthetic: true,
                    textContent: textData || 'New element'
                  };
                  
                  console.log('[ElementDragHandle] Created synthetic payload:', syntheticPayload);
                  
                  // Диспатчим событие для создания нового элемента
                  const createEvent = new CustomEvent('cross-block-create-element', {
                    detail: {
                      sourceBlockId: syntheticPayload.sourceBlockId,
                      targetBlockId: targetBlockId,
                      elementData: {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: syntheticPayload.textContent
                          }
                        ]
                      },
                      targetPosition: 'after'
                    }
                  });
                  
                  document.dispatchEvent(createEvent);
                  console.log('[ElementDragHandle] Dispatched cross-block-create-element event');
                  
                  // Диспатчим событие для удаления текста из исходного блока
                  if (syntheticPayload.sourceBlockId && syntheticPayload.textContent) {
                    const removeEvent = new CustomEvent('remove-text-from-block', {
                      detail: {
                        blockId: syntheticPayload.sourceBlockId,
                        textToRemove: syntheticPayload.textContent
                      }
                    });
                    
                    document.dispatchEvent(removeEvent);
                    console.log('[ElementDragHandle] Dispatched remove-text-from-block event');
                  }
                  
                } else {
                  console.log('[ElementDragHandle] Real element move detected');
                  
                  // Находим элемент в исходном блоке
                  const element = findElementById(view.state.doc, payload.elementId);
                  if (element) {
                    console.log('[ElementDragHandle] Found element to move:', element);
                    
                    // Диспатчим событие для перемещения элемента
                    const moveEvent = new CustomEvent('cross-block-element-move', {
                      detail: {
                        sourceBlockId: payload.sourceBlockId,
                        targetBlockId: targetBlockId,
                        elementData: element,
                        targetPosition: 'after'
                      }
                    });
                    
                    document.dispatchEvent(moveEvent);
                    console.log('[ElementDragHandle] Dispatched cross-block-element-move event');
                  } else {
                    console.log('[ElementDragHandle] Element not found, creating synthetic element');
                    
                    // Fallback: создаем синтетический элемент
                    const syntheticPayload: ExtendedDndPayload = {
                      type: 'element',
                      elementId: 'synthetic',
                      sourceBlockId: payload.sourceBlockId,
                      synthetic: true,
                      textContent: textData || 'Moved element'
                    };
                    
                    const createEvent = new CustomEvent('cross-block-create-element', {
                      detail: {
                        sourceBlockId: syntheticPayload.sourceBlockId,
                        targetBlockId: targetBlockId,
                        elementData: {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: syntheticPayload.textContent
                            }
                          ]
                        },
                        targetPosition: 'after'
                      }
                    });
                    
                    document.dispatchEvent(createEvent);
                    console.log('[ElementDragHandle] Dispatched synthetic cross-block-create-element event');
                  }
                }
                
              } else if (isIntraList) {
                console.log('[ElementDragHandle] Intra-list reorder detected');
                // Обработка внутриблочного перемещения элементов списка
                // Это можно реализовать позже, если потребуется
              } else {
                console.log('[ElementDragHandle] Same-block operation - no action needed');
              }

              console.log('[ElementDragHandle] ===== DROP HANDLER END =====');
              return true;
            },
          },
        },
      }),
    ];
  },

  onCreate() {
    // Глобальный обработчик dragstart для захвата всех операций перетаскивания
    const globalDragStartHandler = (event: DragEvent) => {
      console.log('[ElementDragHandle] Global dragstart detected');
      
      if (event.target instanceof HTMLElement) {
        const target = event.target;
        
        // Проверяем, является ли это текстовым выделением
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          console.log('[ElementDragHandle] Text selection drag detected:', selection.toString());
          
          // Находим ближайший блок
          const blockElement = target.closest('[data-block-id]');
          if (blockElement) {
            const blockId = blockElement.getAttribute('data-block-id');
            if (blockId) {
              console.log('[ElementDragHandle] Saving source block ID for text drag:', blockId);
              (window as any).__originalDragBlockId = blockId;
            }
          }
        }
      }
    };
    
    document.addEventListener('dragstart', globalDragStartHandler);
    
    // Сохраняем ссылку на обработчик для удаления
    (this as any).globalDragStartHandler = globalDragStartHandler;
  },

  onDestroy() {
    // Удаляем глобальный обработчик
    const handler = (this as any).globalDragStartHandler;
    if (handler) {
      document.removeEventListener('dragstart', handler);
    }
  },

  createElementDecorations(doc: any) {
    const decorations: Decoration[] = [];
    
    // Получаем blockId один раз для всех декораций
    const blockId = this.getBlockIdFromDocument(doc);
    if (!blockId) {
      return DecorationSet.empty;
    }

    // Находим все элементы списка
    const listItems = findChildren(doc, (node) => {
      return node.type.name === 'listItem' || node.type.name === 'taskItem';
    });

    listItems.forEach((item) => {
      const elementId = this.generateElementId(item.node);
      
      const decoration = Decoration.widget(
        item.pos,
        () => {
          const handle = document.createElement('div');
          handle.className = 'element-drag-handle-widget ProseMirror-widget';
          handle.setAttribute('data-element-id', elementId);
          handle.setAttribute('data-block-id', blockId);
          handle.style.cssText = `
            position: absolute;
            left: -${this.options.dragHandleWidth}px;
            top: 0;
            width: ${this.options.dragHandleWidth}px;
            height: 20px;
            background-color: ${this.options.dragHandleColor};
            border: 1px solid #d1d5db;
            border-radius: 4px;
            cursor: grab;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: #6b7280;
            z-index: 10;
            transition: background-color 0.2s;
          `;
          handle.innerHTML = '⋮⋮';
          handle.draggable = true;
          
          handle.addEventListener('mouseenter', () => {
            handle.style.backgroundColor = this.options.dragHandleHoverColor;
          });
          
          handle.addEventListener('mouseleave', () => {
            handle.style.backgroundColor = this.options.dragHandleColor;
          });
          
          return handle;
        },
        {
          side: -1,
          key: `drag-handle-${elementId}`,
        }
      );
      
      decorations.push(decoration);
    });

    console.log('[ElementDragHandle] Total decorations created:', decorations.length);
    return DecorationSet.create(doc, decorations);
  },

  getBlockIdFromView(view: any): string | null {
    // Пытаемся получить blockId из различных источников
    const editor = view.dom.closest('[data-block-id]');
    if (editor) {
      return editor.getAttribute('data-block-id');
    }
    
    // Fallback: ищем в родительских элементах
    let element = view.dom.parentElement;
    while (element) {
      if (element.hasAttribute('data-block-id')) {
        return element.getAttribute('data-block-id');
      }
      element = element.parentElement;
    }
    
    return null;
  },

  getBlockIdFromDocument(doc: any): string | null {
    // Пытаемся получить blockId из метаданных документа
    if (doc.attrs && doc.attrs.blockId) {
      return doc.attrs.blockId;
    }
    
    // Fallback: ищем в DOM
    const editor = document.querySelector('.ProseMirror-focused');
    if (editor) {
      return editor.getAttribute('data-block-id');
    }
    
    return null;
  },

  findBlockIdForSelection(view: any, selection: any): string | null {
    // Находим блок, содержащий выделение
    const $from = selection.$from;
    const blockId = $from.node().attrs?.blockId;
    
    if (blockId) {
      return blockId;
    }
    
    // Fallback: ищем в DOM
    return this.getBlockIdFromView(view);
  },

  generateElementId(node: any): string {
    // Генерируем уникальный ID на основе содержимого узла
    const content = this.extractTextFromNode(node);
    const hash = this.simpleHash(content);
    return `element-${hash}`;
  },

  extractTextFromNode(node: any): string {
    if (!node) return '';
    
    if (node.text) {
      return node.text.trim().toLowerCase();
    }
    
    if (node.content && Array.isArray(node.content)) {
      return node.content
        .map((child: any) => this.extractTextFromNode(child))
        .join(' ')
        .trim()
        .toLowerCase();
    }
    
    return '';
  },

  simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  },

  findElementById(doc: any, elementId: string): any {
    // Ищем элемент по ID в документе
    let foundElement: any = null;
    
    doc.descendants((node: any, pos: number) => {
      if (foundElement) return false;
      
      const nodeElementId = this.generateElementId(node);
      if (nodeElementId === elementId) {
        foundElement = {
          type: node.type.name,
          attrs: node.attrs,
          content: node.content ? node.content.toJSON() : undefined,
          pos: pos
        };
        return false;
      }
    });
    
    return foundElement;
  },

  findElementByText(doc: any, text: string): any {
    // Ищем элемент по тексту в документе
    const normalizedText = text.trim().toLowerCase();
    let foundElement: any = null;
    
    doc.descendants((node: any, pos: number) => {
      if (foundElement) return false;
      
      const nodeText = this.extractTextFromNode(node);
      if (nodeText && nodeText.includes(normalizedText)) {
        foundElement = {
          type: node.type.name,
          attrs: node.attrs,
          content: node.content ? node.content.toJSON() : undefined,
          pos: pos
        };
        return false;
      }
    });
    
    return foundElement;
  },

  findElementByTextJSON(doc: any, text: string): any {
    // Ищем элемент по тексту в JSON представлении документа
    const normalizedText = text.trim().toLowerCase();
    const docJSON = doc.toJSON();
    
    const searchInContent = (content: any): any => {
      if (!content) return null;
      
      if (Array.isArray(content)) {
        for (const item of content) {
          const result = searchInContent(item);
          if (result) return result;
        }
      } else if (typeof content === 'object') {
        if (content.text && content.text.toLowerCase().includes(normalizedText)) {
          return content;
        }
        
        if (content.content) {
          const result = searchInContent(content.content);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    return searchInContent(docJSON);
  },

  isListItem(doc: any, pos: number): boolean {
    // Проверяем, находится ли позиция внутри элемента списка
    const $pos = doc.resolve(pos);
    return $pos.parent.type.name === 'listItem' || $pos.parent.type.name === 'taskItem';
  },
});
