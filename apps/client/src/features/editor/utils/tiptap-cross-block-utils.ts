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
    const targetInserted = insertElementIntoTiptapEditor(
      targetEditor,
      sourceElement,
      targetPosition,
      beforeElementId
    );
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

  doc.descendants((node, pos) => {
    if (node.attrs?.elementId === elementId) {
      foundPos = pos;
      return false; // Останавливаем поиск
    }
    return true; // Продолжаем поиск
  });

  return foundPos;
}

/**
 * Извлекает элемент из Tiptap редактора по elementId
 */
function extractElementFromTiptapEditor(editor: Editor, elementId: string): ProseMirrorNode | null {
  try {
    const { doc } = editor.state;
    const pos = findElementPositionInDoc(doc, elementId);
    
    if (pos === -1) {
      return null;
    }

    return doc.nodeAt(pos);
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
    const state = editor.state;
    const { doc } = state;
    const pos = findElementPositionInDoc(doc, elementId);
    
    if (pos === -1) {
      return false;
    }

    const node = doc.nodeAt(pos);
    if (!node) {
      return false;
    }

    const tr = state.tr;
    tr.delete(pos, pos + node.nodeSize);
    editor.view.dispatch(tr);
    
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
    const state = editor.state;
    const { doc } = state;
    
    let insertPos = doc.content.size; // По умолчанию в конец

    if (beforeElementId) {
      const beforePos = findElementPositionInDoc(doc, beforeElementId);
      if (beforePos !== -1) {
        insertPos = targetPosition === 'before' ? beforePos : beforePos + 1;
      }
    }

    const tr = state.tr;
    tr.insert(insertPos, element);
    editor.view.dispatch(tr);
    
    return true;
  } catch (error) {
    console.error('❌ [TiptapCrossBlock] Error inserting element:', error);
    return false;
  }
}
