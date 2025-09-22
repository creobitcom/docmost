import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface InsertPosition {
  pos: number;
  beforeElementId?: string;
}

/**
 * Находит позицию для вставки элемента в списке
 */
export function findInsertPosition(
  editor: Editor,
  targetBlockId: string,
  targetPosition: 'before' | 'after',
  beforeElementId?: string
): InsertPosition | null {
  console.log('🔍 [findInsertPosition] Finding insert position:', {
    targetBlockId,
    targetPosition,
    beforeElementId
  });

  try {
    const doc = editor.state.doc;
    let targetPos = -1;

    // Находим блок с targetBlockId
    doc.descendants((node: ProseMirrorNode, pos: number) => {
      if (node.attrs?.blockId === targetBlockId) {
        targetPos = pos;
        return false; // Останавливаем поиск
      }
    });

    if (targetPos === -1) {
      console.warn('⚠️ [findInsertPosition] Target block not found:', targetBlockId);
      return null;
    }

    console.log('📍 [findInsertPosition] Target block found at position:', targetPos);

    // Если указан beforeElementId, ищем конкретный элемент
    if (beforeElementId) {
      console.log('🔍 [findInsertPosition] Looking for element with ID:', beforeElementId);
      
      let elementPos = -1;
      doc.descendants((node: ProseMirrorNode, pos: number) => {
        if (node.attrs?.elementId === beforeElementId) {
          elementPos = pos;
          return false;
        }
      });

      if (elementPos !== -1) {
        console.log('✅ [findInsertPosition] Element found at position:', elementPos);
        return {
          pos: elementPos,
          beforeElementId
        };
      } else {
        console.warn('⚠️ [findInsertPosition] Element not found, falling back to block position');
      }
    }

    // Определяем позицию вставки относительно блока
    if (targetPosition === 'before') {
      // Вставляем в начало блока
      const insertPos = targetPos + 1; // +1 чтобы попасть внутрь блока
      console.log('📍 [findInsertPosition] Inserting at beginning of block:', insertPos);
      return {
        pos: insertPos,
        beforeElementId
      };
    } else {
      // Вставляем в конец блока
      const targetNode = doc.nodeAt(targetPos);
      if (targetNode) {
        const insertPos = targetPos + targetNode.nodeSize - 1; // -1 чтобы попасть перед закрывающим тегом
        console.log('📍 [findInsertPosition] Inserting at end of block:', insertPos);
        return {
          pos: insertPos,
          beforeElementId
        };
      }
    }

    // Fallback: вставляем в начало документа
    console.log('📍 [findInsertPosition] Fallback: inserting at document start');
    return {
      pos: 0,
      beforeElementId
    };

  } catch (error) {
    console.error('❌ [findInsertPosition] Error finding insert position:', error);
    return null;
  }
}

/**
 * Перемещает элемент в указанную позицию
 */
export function moveElementToPosition(
  editor: Editor,
  sourceElementId: string,
  targetPosition: InsertPosition
): boolean {
  console.log('🔄 [moveElementToPosition] Moving element:', {
    sourceElementId,
    targetPosition
  });

  try {
    const { state, view } = editor;
    const { tr } = state;

    // Находим исходный элемент
    let sourcePos = -1;
    let sourceNode: ProseMirrorNode | null = null;

    state.doc.descendants((node: ProseMirrorNode, pos: number) => {
      if (node.attrs?.elementId === sourceElementId) {
        sourcePos = pos;
        sourceNode = node;
        return false;
      }
    });

    if (sourcePos === -1 || !sourceNode) {
      console.error('❌ [moveElementToPosition] Source element not found:', sourceElementId);
      return false;
    }

    console.log('📍 [moveElementToPosition] Source element found at position:', sourcePos);

    // Удаляем исходный элемент
    const deleteTr = tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);
    
    // Вставляем в новую позицию
    const insertTr = deleteTr.insert(targetPosition.pos, sourceNode);
    
    // Применяем транзакцию
    view.dispatch(insertTr);
    
    console.log('✅ [moveElementToPosition] Element moved successfully');
    return true;

  } catch (error) {
    console.error('❌ [moveElementToPosition] Error moving element:', error);
    return false;
  }
}