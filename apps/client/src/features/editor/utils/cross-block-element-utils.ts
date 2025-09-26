import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import { logCrossBlockTest, logNestedTest, TestResult } from './dnd-test-logger';

/**
 * Рекурсивно очищает пустые элементы из контента
 */
function cleanupContentRecursive(content: any): any {
  if (!content || !Array.isArray(content.content)) {
    return content;
  }

  const newContent = content.content.filter((item: any) => {
    // Рекурсивно очищаем вложенный контент
    if (item.content) {
      item.content = cleanupContentRecursive(item);
    }

    // Фильтруем пустые параграфы
    if (item.type === 'paragraph') {
      const hasText = item.content && item.content.some((node: any) => node.type === 'text' && node.text && node.text.trim().length > 0);
      if (!hasText) {
        return false; // Удаляем пустой параграф
      }
    }

    // Фильтруем пустые элементы списка
    if (item.type === 'listItem' || item.type === 'taskItem') {
      const hasContent = item.content && item.content.length > 0;
      if (!hasContent) {
        console.log('[CrossBlockUtils] Filtering out empty list item:', item.type);
        return false; // Удаляем пустой элемент списка
      }
      
      // Дополнительная проверка: если элемент списка содержит только пустые параграфы
      if (item.content && item.content.length > 0) {
        const hasValidContent = item.content.some((paragraph: any) => 
          paragraph.type === 'paragraph' && 
          paragraph.content && 
          paragraph.content.length > 0 &&
          paragraph.content.some((textNode: any) => 
            textNode.type === 'text' && textNode.text && textNode.text.trim().length > 0
          )
        );
        if (!hasValidContent) {
          console.log('[CrossBlockUtils] Filtering out list item with only empty paragraphs');
          return false;
        }
      }
    }

    return true;
  });

  // Если список (bulletList, orderedList, taskList) становится пустым, удаляем его
  if ((content.type === 'bulletList' || content.type === 'orderedList' || content.type === 'taskList') && newContent.length === 0) {
    return null; // Указываем, что список должен быть удален
  }

  return {
    ...content,
    content: newContent
  };
}

/**
 * Утилиты для работы с элементами списков между блоками
 */

export interface ElementData {
  id: string;
  type: 'listItem' | 'taskItem';
  content: any;
  position: number;
  parentBlockId: string;
}

export interface CrossBlockMoveOperation {
  sourceBlockId: string;
  targetBlockId: string;
  elementData: ElementData;
  targetPosition: 'before' | 'after' | 'inside';
  pageId?: string; // Added pageId for page-specific event handling
}

/**
 * Extract an element from a ProseMirror block by elementId.
 * Recursively searches nested structures and provides a fallback
 * if the element is not found.
 *
 * @param block - ProseMirror Node representing the block
 * @param elementId - the ID of the element to find
 * @returns the found ElementData, or null if not found
 */
export function extractElementFromBlock(block: any, elementId: string): ElementData | null {
  console.log('🔍 [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK =====');
  console.log('🔍 [CrossBlockUtils] Element ID:', elementId);
  console.log('🔍 [CrossBlockUtils] Block exists:', !!block);
  console.log('🔍 [CrossBlockUtils] Block type:', typeof block);
  
  // Логируем для тестирования nested structures
  logNestedTest(TestResult.NOT_TESTED, 'Extracting element from block - nested structure check', {
    elementId,
    blockExists: !!block,
    blockType: typeof block,
    operation: 'extractElementFromBlock'
  });
  
  if (!block || !elementId) {
    console.warn('⚠️ [CrossBlockUtils] Invalid parameters for extractElementFromBlock');
    console.log('⚠️ [CrossBlockUtils] Block valid:', !!block);
    console.log('⚠️ [CrossBlockUtils] ElementId valid:', !!elementId);
    console.log('❌ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK FAILED =====');
    return null;
  }

  console.log('🔍 [CrossBlockUtils] Block details:', { 
    blockId: block.id, 
    elementId,
    blockType: block.type?.name || block.blockType,
    hasContent: !!block?.content,
    hasContentContent: !!block?.content?.content,
    contentSize: block?.content?.size || block?.content?.length || 0,
    contentContentSize: block?.content?.content?.size || block?.content?.content?.length || 0,
    blockKeys: Object.keys(block || {}),
    contentKeys: Object.keys(block?.content || {}),
    contentContentKeys: Object.keys(block?.content?.content || {})
  });

  try {
    // Определяем, где искать контент
    // Блок может иметь структуру: block.content.content (для JSON) или block.content (для ProseMirror)
    console.log('🔍 [CrossBlockUtils] Determining content structure...');
    let contentToSearch: any = null;
    
    if (block.content?.content) {
      // JSON структура: block.content.content
      contentToSearch = block.content.content;
      console.log('✅ [CrossBlockUtils] Using JSON structure: block.content.content');
    } else if (block.content) {
      // ProseMirror структура: block.content
      contentToSearch = block.content;
      console.log('✅ [CrossBlockUtils] Using ProseMirror structure: block.content');
    }
    
    console.log('🔍 [CrossBlockUtils] Content to search:', {
      exists: !!contentToSearch,
      type: typeof contentToSearch,
      isArray: Array.isArray(contentToSearch),
      hasSize: contentToSearch?.size !== undefined,
      size: contentToSearch?.size,
      length: contentToSearch?.length,
      keys: Object.keys(contentToSearch || {})
    });
    
    if (!contentToSearch) {
      console.warn('⚠️ [CrossBlockUtils] Block has no content to search');
      console.log('❌ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK FAILED =====');
      return null;
    }

    // Проверяем, есть ли контент для поиска
    const hasContent = contentToSearch.size !== undefined ? contentToSearch.size > 0 : 
                      Array.isArray(contentToSearch) ? contentToSearch.length > 0 : false;
    
    console.log('🔍 [CrossBlockUtils] Content validation:', {
      hasContent,
      contentSize: contentToSearch.size || contentToSearch.length || 0,
      isArray: Array.isArray(contentToSearch),
      hasSizeProperty: contentToSearch.size !== undefined
    });
    
    if (!hasContent) {
      console.warn('⚠️ [CrossBlockUtils] Block content is empty');
      console.log('❌ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK FAILED =====');
      return null;
    }

    let foundNode: any = null;
    let foundPosition = -1;
    let foundParentBlockId = block.id;

    // Рекурсивная функция для поиска узла
    function findNode(node: any, position: number = 0): any {
      console.log(`🔍 [CrossBlockUtils] Checking node at position ${position}:`, {
        type: node.type,
        hasAttrs: !!node.attrs,
        attrs: node.attrs,
        elementId: node.attrs?.elementId,
        blockId: node.attrs?.blockId,
        blockid: node.attrs?.blockid,
        hasContent: !!node.content,
        contentSize: node.content?.size || node.content?.length || 0,
        allAttrs: node.attrs
      });

      // Проверяем текущий узел по elementId
      const nodeElementId = node.attrs?.elementId;
      if (nodeElementId === elementId) {
        console.log(`✅ [CrossBlockUtils] Found element by attrs.elementId: ${elementId}`);
        foundNode = node;
        foundPosition = position;
        return node;
      }

      // Рекурсивно ищем в дочерних узлах
      if (node.content) {
        console.log(`🔍 [CrossBlockUtils] Searching in child content at position ${position}...`);
        // Проверяем, это ProseMirror Fragment или обычный массив
        if (node.content.size !== undefined) {
          // ProseMirror Fragment
          console.log(`🔍 [CrossBlockUtils] ProseMirror Fragment with ${node.content.size} children`);
          for (let i = 0; i < node.content.size; i++) {
            const child = node.content.child(i);
            console.log(`🔍 [CrossBlockUtils] Checking ProseMirror child ${i}:`, {
              type: child.type?.name,
              hasAttrs: !!child.attrs,
              elementId: child.attrs?.elementId
            });
            const found = findNode(child, i);
            if (found) {
              if (foundPosition === -1) {
                foundPosition = position;
              }
              return found;
            }
          }
        } else if (Array.isArray(node.content)) {
          // Обычный массив
          console.log(`🔍 [CrossBlockUtils] Array with ${node.content.length} children`);
          for (let i = 0; i < node.content.length; i++) {
            const child = node.content[i];
            console.log(`🔍 [CrossBlockUtils] Checking array child ${i}:`, {
              type: child.type,
              hasAttrs: !!child.attrs,
              elementId: child.attrs?.elementId
            });
            const found = findNode(child, i);
            if (found) {
              if (foundPosition === -1) {
                foundPosition = position;
              }
              return found;
            }
          }
        }
      }

      return null;
    }

    // Запускаем поиск по elementId в contentToSearch
    console.log('🔍 [CrossBlockUtils] Starting search in contentToSearch...');
    const foundByElementId = findNode(contentToSearch, 0);
    if (foundByElementId) {
      console.log('✅ [CrossBlockUtils] Element found successfully by elementId:', {
        elementId,
        type: foundNode.type,
        position: foundPosition,
        parentBlockId: foundParentBlockId
      });
      
      const elementData = {
        id: elementId,
        type: foundNode.type === 'paragraph' ? 'taskItem' : foundNode.type,
        content: foundNode,
        position: foundPosition,
        parentBlockId: foundParentBlockId,
      };
      
      console.log('✅ [CrossBlockUtils] ElementData created:', {
        id: elementData.id,
        type: elementData.type,
        position: elementData.position,
        parentBlockId: elementData.parentBlockId,
        hasContent: !!elementData.content,
        contentType: typeof elementData.content,
        contentKeys: Object.keys(elementData.content || {}),
        contentAttrs: elementData.content?.attrs,
        contentTypeName: elementData.content?.type?.name || elementData.content?.type
      });
      
      // Логируем успешное извлечение для nested structures
      logNestedTest(TestResult.SUCCESS, 'Element extracted successfully from nested structure', {
        elementId,
        elementType: elementData.type,
        position: elementData.position,
        parentBlockId: elementData.parentBlockId,
        hasContent: !!elementData.content,
        operation: 'extractElementFromBlock'
      });
      
      console.log('✅ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK SUCCESS =====');
      return elementData;
    }

    // Fallback: ищем по blockId для top-level нод
    console.log('🔍 [CrossBlockUtils] Element not found by elementId, trying fallback search...');
    
    // Преобразуем contentToSearch в массив для удобства работы
    let contentArray: any[] = [];
    if (contentToSearch.size !== undefined) {
      // ProseMirror Fragment
      console.log('🔍 [CrossBlockUtils] Converting ProseMirror Fragment to array...');
      for (let i = 0; i < contentToSearch.size; i++) {
        contentArray.push(contentToSearch.child(i));
      }
    } else if (Array.isArray(contentToSearch)) {
      // Обычный массив
      console.log('🔍 [CrossBlockUtils] Using existing array...');
      contentArray = contentToSearch;
    }
    
    console.log('🔍 [CrossBlockUtils] Content array length:', contentArray.length);

    for (let i = 0; i < contentArray.length; i++) {
      const node = contentArray[i];
      console.log(`🔍 [CrossBlockUtils] Checking fallback node ${i}:`, {
        type: node.type,
        hasAttrs: !!node.attrs,
        elementId: node.attrs?.elementId,
        blockId: node.attrs?.blockId,
        blockid: node.attrs?.blockid
      });
      
      // Если у ноды нет elementId, но есть blockId, ищем по blockId
      if (!node.attrs?.elementId && node.attrs?.blockId === elementId) {
        console.log('✅ [CrossBlockUtils] Found element by fallback blockId:', elementId);
        
        // Генерируем elementId для ноды, если его нет
        const nodeWithElementId = {
          ...node,
          attrs: {
            ...node.attrs,
            elementId: elementId
          }
        };
        
        const elementData = {
          id: elementId,
          type: node.type === 'paragraph' ? 'taskItem' : node.type,
          content: nodeWithElementId,
          position: i,
          parentBlockId: block.id,
        };
        
        console.log('✅ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK SUCCESS (FALLBACK 1) =====');
        return elementData;
      }
      
      // Если это единственная нода в блоке и у неё нет elementId, считаем её искомой
      if (contentArray.length === 1 && !node.attrs?.elementId) {
        console.log('✅ [CrossBlockUtils] Found single node without elementId, assuming it\'s the target:', elementId);
        
        const nodeWithElementId = {
          ...node,
          attrs: {
            ...node.attrs,
            elementId: elementId
          }
        };
        
        const elementData = {
          id: elementId,
          type: node.type === 'paragraph' ? 'taskItem' : node.type,
          content: nodeWithElementId,
          position: i,
          parentBlockId: block.id,
        };
        
        console.log('✅ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK SUCCESS (FALLBACK 2) =====');
        return elementData;
      }
    
      // Fallback: если это текстовый узел без elementId, считаем его искомым
      if (!node.attrs?.elementId && node.type === 'text') {
        console.log('✅ [CrossBlockUtils] Found text node without elementId in fallback, assuming it\'s the target:', elementId);
        
        const nodeWithElementId = {
          ...node,
          attrs: {
            ...node.attrs,
            elementId: elementId
          }
        };
        
        const elementData = {
          id: elementId,
          type: node.type === 'paragraph' ? 'taskItem' : node.type,
          content: nodeWithElementId,
          position: i,
          parentBlockId: block.id,
        };
        
        console.log('✅ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK SUCCESS (FALLBACK 3) =====');
        return elementData;
      }
    
      // Fallback: если это параграф с текстовым содержимым, считаем его искомым
      if (!node.attrs?.elementId && node.type === 'paragraph' && node.content && node.content.length > 0) {
        console.log('✅ [CrossBlockUtils] Found paragraph with text content without elementId, assuming it\'s the target:', elementId);
        
        const nodeWithElementId = {
          ...node,
          attrs: {
            ...node.attrs,
            elementId: elementId
          }
        };
        
        const elementData = {
          id: elementId,
          type: node.type === 'paragraph' ? 'taskItem' : node.type,
          content: nodeWithElementId,
          position: i,
          parentBlockId: block.id,
        };
        
        console.log('✅ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK SUCCESS (FALLBACK 4) =====');
        return elementData;
      }
    }

    console.warn(`⚠️ [CrossBlockUtils] Element not found: ${elementId} in blockType: ${block.type?.name || block.blockType || 'unknown'}`);
    console.warn('⚠️ [CrossBlockUtils] Block structure for debugging:', JSON.stringify(block, null, 2));
    
    // Логируем неудачное извлечение для nested structures
    logNestedTest(TestResult.FAILED, 'Element not found in nested structure', {
      elementId,
      blockType: block.type?.name || block.blockType || 'unknown',
      operation: 'extractElementFromBlock'
    });
    
    console.log('❌ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK FAILED =====');
    return null;
  } catch (error) {
    console.error('❌ [CrossBlockUtils] Error in extractElementFromBlock:', error);
    console.error('❌ [CrossBlockUtils] Error stack:', error.stack);
    console.log('❌ [CrossBlockUtils] ===== EXTRACT ELEMENT FROM BLOCK ERROR =====');
    return null;
  }
}

/**
 * Извлекает блок из редактора по blockId
 * @param editor - TipTap редактор
 * @param blockId - ID блока для поиска
 * @returns ProseMirror Node блока или null
 */
export function extractBlockFromEditor(editor: Editor, blockId: string): ProseMirrorNode | null {
  console.log('🔍 [CrossBlockUtils] ===== EXTRACT BLOCK FROM EDITOR =====');
  console.log('🔍 [CrossBlockUtils] Block ID:', blockId);
  console.log('🔍 [CrossBlockUtils] Editor exists:', !!editor);
  
  if (!editor || !blockId) {
    console.warn('⚠️ [CrossBlockUtils] Invalid parameters for extractBlockFromEditor');
    console.log('⚠️ [CrossBlockUtils] Editor valid:', !!editor);
    console.log('⚠️ [CrossBlockUtils] BlockId valid:', !!blockId);
    console.log('❌ [CrossBlockUtils] ===== EXTRACT BLOCK FROM EDITOR FAILED =====');
    return null;
  }

  try {
    console.log('🔍 [CrossBlockUtils] Extracting block from editor:', { blockId });

    const doc = editor.state.doc;
    console.log('🔍 [CrossBlockUtils] Document info:', {
      childCount: doc.childCount,
      docType: doc.type.name
    });
    
    // Ищем блок по blockId в документе
    for (let i = 0; i < doc.childCount; i++) {
      const child = doc.child(i);
      
      console.log(`🔍 [CrossBlockUtils] Checking block ${i}:`, {
        type: child.type.name,
        hasAttrs: !!child.attrs,
        attrs: child.attrs,
        blockId: child.attrs?.blockId,
        hasContent: !!child.content,
        contentSize: child.content?.size || 0
      });

      if (child.attrs?.blockId === blockId) {
        console.log('✅ [CrossBlockUtils] Found block by blockId:', blockId);
        console.log('✅ [CrossBlockUtils] ===== EXTRACT BLOCK FROM EDITOR SUCCESS =====');
        return child;
      }
    }

    console.warn(`⚠️ [CrossBlockUtils] Block not found: ${blockId} in editor`);
    console.log('❌ [CrossBlockUtils] ===== EXTRACT BLOCK FROM EDITOR FAILED =====');
    return null;
  } catch (error) {
    console.error('❌ [CrossBlockUtils] Error in extractBlockFromEditor:', error);
    console.error('❌ [CrossBlockUtils] Error stack:', error.stack);
    console.log('❌ [CrossBlockUtils] ===== EXTRACT BLOCK FROM EDITOR ERROR =====');
    return null;
  }
}

/**
 * Рекурсивно удаляет элемент по elementId из блока
 * Работает с ProseMirrorNode объектами и любой глубиной вложенности
 */
export function removeElementFromBlock(block: any, elementData: ElementData): any {
  try {
    console.log('[CrossBlockUtils] Removing element from block:', { blockId: block.id, elementId: elementData.id });
    
    // Делаем глубокую копию для безопасности
    const updatedContent = JSON.parse(JSON.stringify(block.content));
    
    // Рекурсивная функция для поиска и удаления элементов
    function recursiveRemove(node: any): any {
      if (!node) return null;
      
      // Проверяем текущий узел на совпадение по attrs.elementId
      if (node?.attrs?.elementId === elementData.id) {
        console.log('[CrossBlockUtils] Found element to remove:', node.type, node.attrs.elementId);
        return null; // Помечаем для удаления
      }
      
      // Рекурсивно обрабатываем содержимое узла
      if (node.content && Array.isArray(node.content)) {
        const filteredContent = node.content
          .map((child: any) => recursiveRemove(child))
          .filter(Boolean); // Убираем null значения
        
        // Если после фильтрации содержимое пустое и это список - можем убрать список
        if (filteredContent.length === 0 && 
            ['bulletList', 'orderedList', 'taskList'].includes(node.type)) {
          console.log('[CrossBlockUtils] Removing empty list:', node.type);
          return null;
        }
        
        return {
          ...node,
          content: filteredContent
        };
      }
      
      return node;
    }
    
    // Обрабатываем весь блок
    const updatedBlockContent = recursiveRemove(updatedContent);
    
    const updatedBlock = {
      ...block,
      content: updatedBlockContent
    };
    
    console.log('[CrossBlockUtils] Element removed successfully with recursive search');
    console.log('[CrossBlockUtils] Remaining content:', updatedBlock.content);
    return updatedBlock;
  } catch (error) {
    console.error('[CrossBlockUtils] Error removing element:', error);
    return block;
  }
}

/**
 * Добавляет элемент в блок
 * Поддерживает различные типы блоков и позиции вставки
 */
export function addElementToBlock(
  block: any, 
  elementData: ElementData, 
  targetPosition: 'before' | 'after' | 'inside'
): any {
  try {
    console.log('[CrossBlockUtils] Adding element to block:', { 
      blockId: block.id, 
      elementId: elementData.id, 
      targetPosition 
    });
    
    // Логируем для тестирования nested structures
    logNestedTest(TestResult.NOT_TESTED, 'Adding element to block - nested structure check', {
      blockId: block.id,
      elementId: elementData.id,
      elementType: elementData.type,
      targetPosition,
      operation: 'addElementToBlock'
    });
    
    // Делаем глубокую копию для безопасности
    const updatedContent = JSON.parse(JSON.stringify(block.content));
    
    // Убеждаемся, что у нас есть content.content для JSON структуры
    if (!updatedContent.content) {
      updatedContent.content = [];
    }
    
    // Сохраняем оригинальный elementId и все атрибуты
    console.log('[CrossBlockUtils] Original elementData.content:', elementData.content);
    console.log('[CrossBlockUtils] Original elementData.content.attrs:', elementData.content.attrs);
    console.log('[CrossBlockUtils] Original elementData.content.content:', elementData.content.content);
    
    const updatedElementContent = {
      ...elementData.content,
      attrs: {
        ...elementData.content?.attrs,
        // Сохраняем исходный идентификатор элемента
        elementId: elementData.id,
        blockId: elementData.id,
      }
    };

    // Убираем пустые параграфы из содержимого элемента
    if (updatedElementContent.content && Array.isArray(updatedElementContent.content)) {
      updatedElementContent.content = updatedElementContent.content.filter((item: any) => {
        // Убираем пустые параграфы
        if (item.type === 'paragraph' && (!item.content || item.content.length === 0)) {
          console.log('[CrossBlockUtils] Filtering out empty paragraph');
          return false;
        }
        // Убираем параграфы с только пробелами
        if (item.type === 'paragraph' && item.content && item.content.length === 1 && 
            item.content[0].type === 'text' && item.content[0].text?.trim() === '') {
          console.log('[CrossBlockUtils] Filtering out whitespace-only paragraph');
          return false;
        }
        // Убираем параграфы с только пустыми текстовыми узлами
        if (item.type === 'paragraph' && item.content && item.content.length > 0) {
          const hasNonEmptyText = item.content.some((textNode: any) => 
            textNode.type === 'text' && textNode.text && textNode.text.trim().length > 0
          );
          if (!hasNonEmptyText) {
            console.log('[CrossBlockUtils] Filtering out paragraph with only empty text nodes');
            return false;
          }
        }
        return true;
      });
      
      // Если после фильтрации не осталось контента, НЕ создаем минимальный контент
      // Вместо этого возвращаем null, чтобы предотвратить создание пустого элемента
      if (updatedElementContent.content.length === 0) {
        console.log('[CrossBlockUtils] No valid content left after filtering, aborting element creation');
        return null; // Это предотвратит создание пустого элемента
      }
    }
    // Проверяем, что элемент имеет валидное содержимое
    if (!updatedElementContent || !updatedElementContent.content || updatedElementContent.content.length === 0) {
      console.log('[CrossBlockUtils] Element has no valid content, aborting addition');
      return block; // Возвращаем исходный блок без изменений
    }

    console.log('[CrossBlockUtils] Updated element content:', updatedElementContent);
    console.log('[CrossBlockUtils] Updated element content.attrs:', updatedElementContent.attrs);
    console.log('[CrossBlockUtils] Updated element content.content:', updatedElementContent.content);
    
    if (targetPosition === 'inside') {
      // Добавляем элемент внутрь существующего списка или создаем новый
      const listNode = updatedContent.content.find((node: any) => 
        node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList'
      );
      
      if (listNode) {
        // Добавляем в существующий список
        if (!listNode.content) {
          listNode.content = [];
        }
        listNode.content.push(updatedElementContent);
        logCrossBlockTest(TestResult.SUCCESS, 'Element inserted into existing list', {
          listType: listNode.type,
          elementType: elementData.type,
          listItemsCount: listNode.content.length,
          targetPosition: 'inside'
        });
      } else {
        // Создаем новый список
        const newList = {
          type: elementData.type === 'taskItem' ? 'taskList' : 'bulletList',
          content: [updatedElementContent]
        };
        updatedContent.content.push(newList);
        logCrossBlockTest(TestResult.SUCCESS, 'New list created for element insertion', {
          newListType: newList.type,
          elementType: elementData.type,
          targetPosition: 'inside'
        });
      }
    } else {
      // Добавляем элемент рядом с блоком (до/после всего содержимого блока)
      const insertIndex = targetPosition === 'after' ? updatedContent.content.length : 0;
      updatedContent.content.splice(insertIndex, 0, updatedElementContent);
      logCrossBlockTest(TestResult.SUCCESS, 'Element inserted next to block', {
        elementType: elementData.type,
        targetPosition,
        insertIndex,
        totalContentItems: updatedContent.content.length
      });
    }
    
    // Дополнительная проверка: убеждаемся, что мы не создали пустые элементы
    updatedContent.content = updatedContent.content.filter((item: any) => {
      // Проверяем, что элемент имеет валидное содержимое
      if (item.type === 'listItem' || item.type === 'taskItem') {
        // Для элементов списка проверяем, что есть хотя бы один параграф с контентом
        if (item.content && item.content.length > 0) {
          const hasValidContent = item.content.some((paragraph: any) => 
            paragraph.type === 'paragraph' && 
            paragraph.content && 
            paragraph.content.length > 0 &&
            paragraph.content.some((textNode: any) => 
              textNode.type === 'text' && textNode.text && textNode.text.trim().length > 0
            )
          );
          if (!hasValidContent) {
            console.log('[CrossBlockUtils] Filtering out list item with no valid content');
            return false;
          }
        } else {
          console.log('[CrossBlockUtils] Filtering out list item with no content');
          return false;
        }
      }
      return true;
    });
    
    const updatedBlock = {
      ...block,
      content: updatedContent
    };
    
    console.log('[CrossBlockUtils] Element added successfully');
    
    // Логируем успешное добавление для nested structures
    logNestedTest(TestResult.SUCCESS, 'Element added successfully to nested structure', {
      blockId: block.id,
      elementId: elementData.id,
      elementType: elementData.type,
      targetPosition,
      operation: 'addElementToBlock'
    });
    
    return updatedBlock;
  } catch (error) {
    console.error('[CrossBlockUtils] Error adding element:', error);
    
    // Логируем ошибку для nested structures
    logNestedTest(TestResult.FAILED, 'Error adding element to nested structure', {
      blockId: block.id,
      elementId: elementData.id,
      elementType: elementData.type,
      targetPosition,
      error: error.message,
      operation: 'addElementToBlock'
    });
    
    return block;
  }
}

/**
 * Перемещает элемент между блоками
 * Работает с ProseMirrorNode объектами и любой глубиной вложенности
 */
export function moveElementBetweenBlocks(
  blocks: any[],
  sourceBlockId: string,
  targetBlockId: string,
  elementData: ElementData,
  targetPosition: 'before' | 'after' | 'inside'
): any[] {
  console.log('🔄 [CrossBlockUtils] ===== MOVE ELEMENT BETWEEN BLOCKS =====');
  console.log('🔄 [CrossBlockUtils] Move details:', {
    sourceBlockId,
    targetBlockId,
    elementId: elementData.id,
    targetPosition
  });
  
  try {
    
    console.log('🔄 [CrossBlockUtils] Element data details:', {
      id: elementData.id,
      type: elementData.type,
      content: elementData.content,
      position: elementData.position,
      parentBlockId: elementData.parentBlockId
    });
    
    // Находим блоки
    console.log('🔍 [CrossBlockUtils] Available blocks:', blocks.map(b => ({ id: b.id, blockType: b.blockType })));
    console.log('🔍 [CrossBlockUtils] Looking for sourceBlockId:', sourceBlockId);
    console.log('🔍 [CrossBlockUtils] Looking for targetBlockId:', targetBlockId);
    
    const sourceBlock = blocks.find(b => b.id === sourceBlockId);
    const targetBlock = blocks.find(b => b.id === targetBlockId);
    
    console.log('🔍 [CrossBlockUtils] Found sourceBlock:', sourceBlock ? { id: sourceBlock.id, blockType: sourceBlock.blockType } : null);
    console.log('🔍 [CrossBlockUtils] Found targetBlock:', targetBlock ? { id: targetBlock.id, blockType: targetBlock.blockType } : null);
    
    if (!sourceBlock || !targetBlock) {
      console.warn('⚠️ [CrossBlockUtils] Source or target block not found');
      console.warn('⚠️ [CrossBlockUtils] Available block IDs:', blocks.map(b => b.id));
      console.warn('⚠️ [CrossBlockUtils] Looking for sourceBlockId:', sourceBlockId);
      console.warn('⚠️ [CrossBlockUtils] Looking for targetBlockId:', targetBlockId);
      console.log('❌ [CrossBlockUtils] ===== MOVE ELEMENT BETWEEN BLOCKS FAILED =====');
      return blocks; // Возвращаем исходные блоки без изменений
    }
    
    // Если в elementData нет content, извлечём его из source блока
    console.log('🔄 [CrossBlockUtils] Step 1: Extracting element content if needed...');
    let effectiveElement = elementData;
    if (!effectiveElement.content) {
      console.log('🔄 [CrossBlockUtils] Element data has no content, extracting from source block...');
      const extracted = extractElementFromBlock(sourceBlock, elementData.id);
      if (extracted) {
        effectiveElement = extracted;
        console.log('✅ [CrossBlockUtils] Element content extracted successfully');
      } else {
        console.warn('⚠️ [CrossBlockUtils] Failed to extract element content, aborting move');
        console.log('❌ [CrossBlockUtils] ===== MOVE ELEMENT BETWEEN BLOCKS FAILED =====');
        return blocks;
      }
    } else {
      console.log('✅ [CrossBlockUtils] Element data already has content');
    }

    // Удаляем элемент из source блока
    console.log('🔄 [CrossBlockUtils] Step 2: Removing element from source block...');
    const updatedSourceBlock = removeElementFromBlock(sourceBlock, effectiveElement);
    console.log('✅ [CrossBlockUtils] Element removed from source block');

    // Добавляем элемент в target блок
    console.log('🔄 [CrossBlockUtils] Step 3: Adding element to target block...');
    const updatedTargetBlock = addElementToBlock(targetBlock, effectiveElement, targetPosition);
    
    // Проверяем, что элемент был успешно добавлен
    if (!updatedTargetBlock) {
      console.warn('⚠️ [CrossBlockUtils] Failed to add element to target block, aborting move');
      return blocks; // Возвращаем исходные блоки без изменений
    }
    
    console.log('✅ [CrossBlockUtils] Element added to target block');
    
    // Обновляем массив блоков
    console.log('🔄 [CrossBlockUtils] Step 4: Updating blocks array...');
    const updatedBlocks = blocks.map(block => {
      if (block.id === sourceBlockId) {
        return updatedSourceBlock;
      }
      if (block.id === targetBlockId) {
        return updatedTargetBlock;
      }
      return block;
    });
    
    // Очищаем пустые элементы после перемещения
    const cleanedBlocks = updatedBlocks.map(block => {
      if (!block || !block.content) {
        return block;
      }

      const cleanedContent = cleanupContentRecursive(block.content);

      return {
        ...block,
        content: cleanedContent
      };
    });

    console.log('✅ [CrossBlockUtils] Element moved successfully');
    console.log('✅ [CrossBlockUtils] ===== MOVE ELEMENT BETWEEN BLOCKS SUCCESS =====');
    return cleanedBlocks;
  } catch (error) {
    console.error('❌ [CrossBlockUtils] Error moving element:', error);
    console.error('❌ [CrossBlockUtils] Error stack:', error.stack);
    console.log('❌ [CrossBlockUtils] ===== MOVE ELEMENT BETWEEN BLOCKS ERROR =====');
    return blocks;
  }
}

/**
 * Создает событие для cross-block перемещения
 */
export function createCrossBlockMoveEvent(operation: CrossBlockMoveOperation): CustomEvent {
  return new CustomEvent('cross-block-element-move', {
    detail: operation
  });
}

/**
 * 🟢 STEP 3: Валидация позиций блоков
 */
export function validateBlockPositions(blocks: any[]): any[] {
  return blocks.map((block, index) => ({
    ...block,
    position: index,
    content: {
      ...block.content,
      attrs: {
        ...block.content?.attrs,
        position: index
      }
    }
  }));
}

/**
 * Обрабатывает cross-block перемещение элемента
 */
export function handleCrossBlockElementMove(
  blocks: any[],
  operation: CrossBlockMoveOperation
): { updatedBlocks: any[]; success: boolean } {
  try {
    logCrossBlockTest(TestResult.NOT_TESTED, 'Cross-block element move started', {
      sourceBlockId: operation.sourceBlockId,
      targetBlockId: operation.targetBlockId,
      elementId: operation.elementData.id,
      targetPosition: operation.targetPosition
    });
    
    const updatedBlocks = moveElementBetweenBlocks(
      blocks,
      operation.sourceBlockId,
      operation.targetBlockId,
      operation.elementData,
      operation.targetPosition
    );
    
    // Валидируем позиции после изменения
    const validatedBlocks = validateBlockPositions(updatedBlocks);
    
    logCrossBlockTest(TestResult.SUCCESS, 'Cross-block element move completed', {
      sourceBlockId: operation.sourceBlockId,
      targetBlockId: operation.targetBlockId,
      elementId: operation.elementData.id,
      targetPosition: operation.targetPosition,
      blocksUpdated: validatedBlocks.length,
      success: true
    });
    
    return {
      updatedBlocks: validatedBlocks,
      success: true
    };
  } catch (error) {
    logCrossBlockTest(TestResult.FAILED, 'Cross-block element move failed', {
      sourceBlockId: operation.sourceBlockId,
      targetBlockId: operation.targetBlockId,
      elementId: operation.elementData.id,
      error: error.message,
      success: false
    });
    
    return {
      updatedBlocks: blocks,
      success: false
    };
  }
}
