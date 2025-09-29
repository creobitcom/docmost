import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';

/**
 * Интерфейс для операции перемещения элемента между Tiptap редакторами
 */
export interface TiptapMoveOperation {
  sourceEditor: Editor;
  targetEditor: Editor;
  elementId: string;
  targetPosition: 'before' | 'after' | 'inside';
  beforeElementId?: string;
}

/**
 * Перемещает элемент внутри одного Tiptap редактора
 */
export function moveElementWithinTiptapEditor(
  editor: Editor,
  elementId: string,
  targetPosition: 'before' | 'after' | 'inside',
  beforeElementId?: string
): boolean {
  try {
    console.log('🔄 [TiptapCrossBlock] Moving element within editor:', {
      elementId,
      targetPosition,
      beforeElementId
    });

    const { state } = editor;
    const { doc } = state;

    // Находим позицию элемента для перемещения
    const sourcePos = findElementPositionInDoc(doc, elementId);
    if (sourcePos === -1) {
      console.warn('⚠️ [TiptapCrossBlock] Source element not found:', elementId);
      return false;
    }

    // Находим позицию целевого элемента
    let targetPos = -1;
    if (beforeElementId) {
      targetPos = findElementPositionInDoc(doc, beforeElementId);
      if (targetPos === -1) {
        console.warn('⚠️ [TiptapCrossBlock] Target element not found:', beforeElementId);
        return false;
      }
    }

    const sourceNode = doc.nodeAt(sourcePos);
    if (!sourceNode) {
      console.warn('⚠️ [TiptapCrossBlock] Source node not found at position:', sourcePos);
      return false;
    }

    const tr = state.tr;

    // Удаляем элемент из исходной позиции
    tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);

    // Корректируем целевую позицию, если она была после исходной позиции
    let adjustedTargetPos = targetPos;
    if (targetPos > sourcePos) {
      adjustedTargetPos = targetPos - sourceNode.nodeSize;
    }

    // Вставляем элемент в новую позицию
    if (targetPosition === 'before' && adjustedTargetPos !== -1) {
      tr.insert(adjustedTargetPos, sourceNode);
    } else if (targetPosition === 'after' && adjustedTargetPos !== -1) {
      tr.insert(adjustedTargetPos + 1, sourceNode);
    } else {
      // Вставляем в конец документа
      tr.insert(doc.content.size, sourceNode);
    }

    editor.view.dispatch(tr);
    console.log('✅ [TiptapCrossBlock] Element moved within editor successfully');
    return true;
  } catch (error) {
    console.error('❌ [TiptapCrossBlock] Error moving element within editor:', error);
    return false;
  }
}

/**
 * Перемещает элемент между разными Tiptap редакторами
 */
export function moveElementBetweenTiptapEditors(operation: TiptapMoveOperation): boolean {
  try {
    console.log('🔄 [TiptapCrossBlock] Moving element between editors:', {
      elementId: operation.elementId,
      targetPosition: operation.targetPosition,
      beforeElementId: operation.beforeElementId
    });

    const { sourceEditor, targetEditor, elementId, targetPosition, beforeElementId } = operation;

    // 🔍 ДИАГНОСТИКА: Анализируем состояние редакторов
    console.log('🔍 [TiptapCrossBlock] Editor states:', {
      sourceEditorExists: !!sourceEditor,
      targetEditorExists: !!targetEditor,
      sourceDocSize: sourceEditor?.state.doc.content.size,
      targetDocSize: targetEditor?.state.doc.content.size,
      sourceElementIds: sourceEditor ? getAllElementIds(sourceEditor.state.doc) : [],
      targetElementIds: targetEditor ? getAllElementIds(targetEditor.state.doc) : []
    });

    // Извлекаем элемент из исходного редактора
    const sourceElement = extractElementFromTiptapEditor(sourceEditor, elementId);
    if (!sourceElement) {
      console.warn('⚠️ [TiptapCrossBlock] Failed to extract element from source editor:', elementId);
      return false;
    }

    // Удаляем элемент из исходного редактора
    const sourceRemoved = removeElementFromTiptapEditor(sourceEditor, elementId);
    if (!sourceRemoved) {
      console.warn('⚠️ [TiptapCrossBlock] Failed to remove element from source editor:', elementId);
      return false;
    }

    // Вставляем элемент в целевой редактор
    console.log('🔍 [TiptapCrossBlock] About to insert element into target editor:', {
      elementId,
      targetPosition,
      beforeElementId,
      sourceElementType: sourceElement.type.name,
      sourceElementSize: sourceElement.nodeSize
    });

    const targetInserted = insertElementIntoTiptapEditor(
      targetEditor,
      sourceElement,
      targetPosition,
      beforeElementId
    );

    console.log('🔍 [TiptapCrossBlock] Insert result:', {
      elementId,
      targetInserted,
      targetPosition,
      beforeElementId
    });

    if (!targetInserted) {
      console.warn('⚠️ [TiptapCrossBlock] Failed to insert element into target editor:', elementId);
      return false;
    }

    console.log('✅ [TiptapCrossBlock] Element moved between editors successfully');
    return true;
  } catch (error) {
    console.error('❌ [TiptapCrossBlock] Error moving element between editors:', error);
    return false;
  }
}

/**
 * Находит позицию элемента в документе по elementId
 */
function findElementPositionInDoc(doc: ProseMirrorNode, elementId: string): number {
  let foundPos = -1;

  console.log('🔍 [TiptapCrossBlock] Searching for element in document:', {
    elementId,
    docSize: doc.content.size,
    totalNodes: doc.content.childCount
  });

  doc.descendants((node, pos) => {
    console.log(`🔍 [TiptapCrossBlock] Checking node at pos ${pos}:`, {
      nodeType: node.type.name,
      hasAttrs: !!node.attrs,
      elementId: node.attrs?.elementId,
      allAttrs: node.attrs
    });

    if (node.attrs?.elementId === elementId) {
      foundPos = pos;
      console.log('✅ [TiptapCrossBlock] Found element in document:', {
        elementId,
        pos,
        nodeType: node.type.name,
        nodeAttrs: node.attrs
      });
      return false; // Останавливаем поиск
    }
    return true; // Продолжаем поиск
  });

  if (foundPos === -1) {
    console.log('❌ [TiptapCrossBlock] Element not found, available elementIds:', {
      elementId,
      totalNodes: doc.content.childCount,
      availableElementIds: getAllElementIds(doc)
    });
  }

  return foundPos;
}

/**
 * Извлекает элемент из Tiptap редактора по elementId
 */
function extractElementFromTiptapEditor(editor: Editor, elementId: string): ProseMirrorNode | null {
  try {
    console.log('🔍 [TiptapCrossBlock] Extracting element:', {
      elementId,
      docSize: editor.state.doc.content.size,
      docContent: editor.state.doc.content.toString()
    });

    const { doc } = editor.state;
    const pos = findElementPositionInDoc(doc, elementId);

    if (pos === -1) {
      console.warn('⚠️ [TiptapCrossBlock] Element not found by elementId, trying fallback methods:', {
        elementId,
        docSize: doc.content.size,
        availableElementIds: getAllElementIds(doc)
      });

      // Fallback 1: Попробуем найти по позиции в drag payload
      const fallbackNode = findElementByFallbackMethods(editor, elementId);
      if (fallbackNode) {
        console.log('✅ [TiptapCrossBlock] Element found by fallback method:', {
          elementId,
          nodeType: fallbackNode.type.name,
          nodeAttrs: fallbackNode.attrs
        });
        return fallbackNode;
      }

      return null;
    }

    const node = doc.nodeAt(pos);
    console.log('✅ [TiptapCrossBlock] Element found:', {
      elementId,
      pos,
      nodeType: node?.type.name,
      nodeAttrs: node?.attrs
    });

    return node;
  } catch (error) {
    console.error('❌ [TiptapCrossBlock] Error extracting element:', error);
    return null;
  }
}

/**
 * Удаляет элемент из Tiptap редактора по elementId
 */
function removeElementFromTiptapEditor(editor: Editor, elementId: string): boolean {
  try {
    console.log('🔍 [TiptapCrossBlock] Removing element:', {
      elementId,
      docSize: editor.state.doc.content.size
    });

    const state = editor.state;
    const { doc } = state;
    let pos = findElementPositionInDoc(doc, elementId);

    // Если не нашли по elementId, используем fallback методы
    if (pos === -1) {
      console.warn('⚠️ [TiptapCrossBlock] Element not found by elementId, trying fallback methods for removal:', {
        elementId,
        docSize: doc.content.size,
        availableElementIds: getAllElementIds(doc)
      });

      // Fallback 1: Попробуем найти по позиции в elementId
      const posMatch = elementId.match(/element-(\d+)-/);
      if (posMatch) {
        pos = parseInt(posMatch[1]);
        console.log('✅ [TiptapCrossBlock] Using position fallback for removal:', {
          elementId,
          pos
        });
      } else {
        console.error('❌ [TiptapCrossBlock] All fallback methods failed for removal:', elementId);
        return false;
      }
    }

    const node = doc.nodeAt(pos);
    if (!node) {
      console.error('❌ [TiptapCrossBlock] Node not found at position for removal:', pos);
      return false;
    }

    console.log('✅ [TiptapCrossBlock] Removing element at position:', {
      elementId,
      pos,
      nodeType: node.type.name,
      nodeSize: node.nodeSize
    });

    const tr = state.tr;
    tr.delete(pos, pos + node.nodeSize);
    editor.view.dispatch(tr);

    console.log('✅ [TiptapCrossBlock] Element removed successfully');
    return true;
  } catch (error) {
    console.error('❌ [TiptapCrossBlock] Error removing element:', error);
    return false;
  }
}

/**
 * Вставляет элемент в Tiptap редактор
 */
function insertElementIntoTiptapEditor(
  editor: Editor,
  element: ProseMirrorNode,
  targetPosition: 'before' | 'after' | 'inside',
  beforeElementId?: string
): boolean {
  try {
    console.log('🔍 [TiptapCrossBlock] Inserting element:', {
      elementType: element.type.name,
      elementSize: element.nodeSize,
      targetPosition,
      beforeElementId,
      docSize: editor.state.doc.content.size
    });

    const state = editor.state;
    const { doc } = state;

    let insertPos = doc.content.size; // По умолчанию в конец

    if (beforeElementId) {
      const beforePos = findElementPositionInDoc(doc, beforeElementId);
      if (beforePos !== -1) {
        insertPos = targetPosition === 'before' ? beforePos : beforePos + 1;
        console.log('✅ [TiptapCrossBlock] Found beforeElementId position:', {
          beforeElementId,
          beforePos,
          targetPosition,
          insertPos
        });
      } else {
        console.warn('⚠️ [TiptapCrossBlock] beforeElementId not found, using end position:', {
          beforeElementId,
          insertPos
        });
      }
    } else {
      console.log('🔍 [TiptapCrossBlock] No beforeElementId, using end position:', insertPos);
    }

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем, что позиция вставки не выходит за пределы документа
    if (insertPos > doc.content.size) {
      console.warn('⚠️ [TiptapCrossBlock] Insert position exceeds document size, adjusting:', {
        insertPos,
        docSize: doc.content.size,
        adjustedPos: doc.content.size
      });
      insertPos = doc.content.size;
    }

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Для taskItem нужно найти или создать taskList
    let taskListPos = -1;
    if (element.type.name === 'taskItem') {
      console.log('🔍 [TiptapCrossBlock] Handling taskItem insertion, checking for taskList...');

      // Ищем существующий taskList в документе
      doc.descendants((node, pos) => {
        if (node.type.name === 'taskList') {
          taskListPos = pos;
          return false; // Останавливаем поиск
        }
      });

      if (taskListPos !== -1) {
        // Найден taskList, вставляем в него
        const taskList = doc.nodeAt(taskListPos);
        if (taskList) {
          // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Для вставки taskItem в taskList используем специальную логику
          // Нужно вставить в конец содержимого taskList, но внутри самого taskList
          // Позиция должна быть: taskListPos + размер содержимого - 1 (последняя позиция внутри taskList)
          insertPos = taskListPos + taskList.content.size - 1;
          console.log('✅ [TiptapCrossBlock] Found existing taskList, inserting at position:', {
            taskListPos,
            insertPos,
            taskListSize: taskList.content.size,
            taskListContentSize: taskList.content.size,
            taskListStart: taskListPos + 1
          });
        }
      } else {
        // taskList не найден, создаем новый
        console.log('🔍 [TiptapCrossBlock] No taskList found, creating new one...');

        // Создаем новый taskList с нашим taskItem
        const taskList = element.type.schema.nodes.taskList.create({}, element);
        insertPos = doc.content.size;

        console.log('🔍 [TiptapCrossBlock] Created new taskList, inserting at position:', {
          insertPos,
          taskListSize: taskList.nodeSize
        });

        // Заменяем элемент на taskList
        element = taskList;
      }
    }

    // Проверяем, что элемент не пустой перед вставкой
    if (element.content && element.content.size === 0) {
      console.warn('⚠️ [TiptapCrossBlock] Attempting to insert empty element, skipping');
      return false;
    }

    // Для taskItem проверяем, что есть содержимое
    if (element.type.name === 'taskItem' || element.type.name === 'listItem') {
      const hasContent = element.content && element.content.size > 0;
      if (!hasContent) {
        console.warn('⚠️ [TiptapCrossBlock] Attempting to insert empty list item, skipping');
        return false;
      }
      console.log('✅ [TiptapCrossBlock] Element content validation passed:', {
        elementType: element.type.name,
        contentSize: element.content.size
      });
    }

    console.log('🔍 [TiptapCrossBlock] About to insert element at position:', {
      insertPos,
      elementType: element.type.name,
      elementSize: element.nodeSize,
      docSize: doc.content.size
    });

    // Проверяем, может ли документ принять этот тип узла
    try {
      const canInsert = state.doc.canReplace(insertPos, insertPos, element.type.create(element.attrs, element.content).content);
      console.log('🔍 [TiptapCrossBlock] Can insert element check:', {
        canInsert,
        insertPos,
        elementType: element.type.name,
        docType: doc.type.name
      });

      if (!canInsert) {
        console.error('❌ [TiptapCrossBlock] Document cannot accept this element type at this position');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ [TiptapCrossBlock] Could not check canReplace, proceeding with insert:', error);
    }

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем, что позиция вставки не выходит за пределы документа
    if (insertPos > doc.content.size) {
      console.warn('⚠️ [TiptapCrossBlock] Insert position exceeds document size, adjusting:', {
        insertPos,
        docSize: doc.content.size,
        adjustedPos: doc.content.size
      });
      insertPos = doc.content.size;
    }

    const tr = state.tr;

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Для taskItem в существующем taskList используем специальную логику
    if (element.type.name === 'taskItem' && taskListPos !== -1) {
      // Найден taskList, вставляем taskItem в него
      const taskList = doc.nodeAt(taskListPos);
      if (taskList) {
        console.log('🔍 [TiptapCrossBlock] Inserting taskItem into existing taskList using replaceWith:', {
          taskListPos,
          taskListContentSize: taskList.content.size,
          elementType: element.type.name,
          beforeElementId,
          targetPosition
        });

        // Создаем новый taskList с добавленным taskItem в правильной позиции
        let newTaskListContent;
        if (beforeElementId) {
          // Нужно вставить перед определенным элементом
          const beforePos = findElementPositionInDoc(taskList, beforeElementId);
          if (beforePos !== -1) {
            // Найдем позицию внутри taskList
            const taskListBeforePos = beforePos - taskListPos - 1;
            console.log('🔍 [TiptapCrossBlock] Inserting before element in taskList:', {
              beforeElementId,
              beforePos,
              taskListBeforePos,
              taskListContentSize: taskList.content.size
            });

            // Вставляем в правильную позицию внутри taskList
            const beforeFragment = taskList.content.cut(0, taskListBeforePos);
            const afterFragment = taskList.content.cut(taskListBeforePos);
            const newElement = element.type.create(element.attrs, element.content);
            newTaskListContent = beforeFragment.append(newElement.content).append(afterFragment);
          } else {
            // Элемент не найден, добавляем в конец
            newTaskListContent = taskList.content.append(element.type.create(element.attrs, element.content).content);
          }
        } else {
          // Добавляем в конец
          newTaskListContent = taskList.content.append(element.type.create(element.attrs, element.content).content);
        }

        const newTaskList = taskList.type.create(taskList.attrs, newTaskListContent);

        // Заменяем старый taskList новым
        tr.replaceWith(taskListPos, taskListPos + taskList.nodeSize, newTaskList);
      } else {
        console.log('🔍 [TiptapCrossBlock] TaskList not found at position, using regular insert:', {
          taskListPos,
          insertPos
        });
        tr.insert(insertPos, element);
      }
    } else {
      console.log('🔍 [TiptapCrossBlock] Using insert for element:', {
        insertPos,
        elementType: element.type.name
      });
      tr.insert(insertPos, element);
    }

    editor.view.dispatch(tr);

    console.log('✅ [TiptapCrossBlock] Element inserted successfully at position:', insertPos);

    // Проверяем состояние документа после вставки
    const newDocSize = editor.state.doc.content.size;
    console.log('🔍 [TiptapCrossBlock] Document state after insertion:', {
      newDocSize,
      previousDocSize: doc.content.size,
      sizeDifference: newDocSize - doc.content.size,
      expectedSize: doc.content.size + element.nodeSize
    });

    return true;
  } catch (error) {
    console.error('❌ [TiptapCrossBlock] Error inserting element:', error);
    return false;
  }
}

/**
 * Получает все elementId из документа для диагностики
 */
function getAllElementIds(doc: ProseMirrorNode): string[] {
  const elementIds: string[] = [];

  doc.descendants((node) => {
    if (node.attrs?.elementId) {
      elementIds.push(node.attrs.elementId);
    }
    return true;
  });

  return elementIds;
}

/**
 * Fallback методы для поиска элемента
 */
function findElementByFallbackMethods(editor: Editor, elementId: string): ProseMirrorNode | null {
  try {
    console.log('🔍 [TiptapCrossBlock] Trying fallback methods for element:', elementId);

    // Fallback 1: Попробуем найти по позиции в elementId
    const posMatch = elementId.match(/element-(\d+)-/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        console.log('✅ [TiptapCrossBlock] Found element by position fallback:', {
          elementId,
          pos,
          nodeType: node.type.name
        });
        return node;
      }
    }

    // Fallback 2: Попробуем найти по типу узла
    const typeMatch = elementId.match(/element-\d+-(.+)/);
    if (typeMatch) {
      const nodeType = typeMatch[1];
      let foundNode: ProseMirrorNode | null = null;

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === nodeType && !foundNode) {
          foundNode = node;
          console.log('✅ [TiptapCrossBlock] Found element by type fallback:', {
            elementId,
            nodeType,
            pos,
            nodeAttrs: node.attrs
          });
          return false;
        }
        return true;
      });

      if (foundNode) {
        return foundNode;
      }
    }

    console.log('❌ [TiptapCrossBlock] All fallback methods failed for element:', elementId);
    return null;
  } catch (error) {
    console.error('❌ [TiptapCrossBlock] Error in fallback methods:', error);
    return null;
  }
}
