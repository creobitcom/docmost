/**
 * Утилиты для очистки пустых элементов в редакторе
 */

/**
 * Очищает пустые параграфы из контента блока
 */
export function cleanupEmptyParagraphs(content: any): any {
  if (!content || !content.content || !Array.isArray(content.content)) {
    return content;
  }

  const cleanedContent = content.content.filter((item: any) => {
    // Убираем пустые параграфы
    if (item.type === 'paragraph') {
      if (!item.content || item.content.length === 0) {
        console.log('[CleanupEmptyElements] Filtering out empty paragraph');
        return false;
      }
      
      // Убираем параграфы с только пробелами
      if (item.content.length === 1 && 
          item.content[0].type === 'text' && 
          item.content[0].text?.trim() === '') {
        console.log('[CleanupEmptyElements] Filtering out whitespace-only paragraph');
        return false;
      }
      
      // Убираем параграфы с только пустыми текстовыми узлами
      const hasNonEmptyText = item.content.some((textNode: any) => 
        textNode.type === 'text' && textNode.text && textNode.text.trim().length > 0
      );
      if (!hasNonEmptyText) {
        console.log('[CleanupEmptyElements] Filtering out paragraph with only empty text nodes');
        return false;
      }
    }
    
    return true;
  });

  return {
    ...content,
    content: cleanedContent
  };
}

/**
 * Очищает пустые элементы списков
 */
export function cleanupEmptyListItems(content: any): any {
  if (!content || !content.content || !Array.isArray(content.content)) {
    return content;
  }

  const cleanedContent = content.content.map((item: any) => {
    if (item.type === 'listItem' || item.type === 'taskItem') {
      // Очищаем содержимое элемента списка
      const cleanedItem = cleanupEmptyParagraphs(item);
      
      // Проверяем, что элемент списка имеет валидное содержимое
      if (cleanedItem.content && cleanedItem.content.length > 0) {
        const hasValidContent = cleanedItem.content.some((paragraph: any) => 
          paragraph.type === 'paragraph' && 
          paragraph.content && 
          paragraph.content.length > 0 &&
          paragraph.content.some((textNode: any) => 
            textNode.type === 'text' && textNode.text && textNode.text.trim().length > 0
          )
        );
        
        if (!hasValidContent) {
          console.log('[CleanupEmptyElements] Filtering out list item with no valid content');
          return null; // Будет отфильтрован
        }
      } else {
        console.log('[CleanupEmptyElements] Filtering out list item with no content');
        return null; // Будет отфильтрован
      }
      
      return cleanedItem;
    }
    
    return item;
  }).filter(Boolean); // Убираем null значения

  return {
    ...content,
    content: cleanedContent
  };
}

/**
 * Полная очистка контента блока от пустых элементов
 */
export function cleanupBlockContent(content: any): any {
  if (!content) {
    return content;
  }

  console.log('[CleanupEmptyElements] Starting cleanup of block content');
  
  // Сначала очищаем пустые параграфы
  let cleanedContent = cleanupEmptyParagraphs(content);
  
  // Затем очищаем пустые элементы списков
  cleanedContent = cleanupEmptyListItems(cleanedContent);
  
  // Если после очистки не осталось контента, создаем минимальный контент
  if (!cleanedContent.content || cleanedContent.content.length === 0) {
    console.log('[CleanupEmptyElements] No content left after cleanup, creating minimal content');
    cleanedContent = {
      ...cleanedContent,
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [
            {
              type: 'text',
              text: ' '
            }
          ]
        }
      ]
    };
  }
  
  console.log('[CleanupEmptyElements] Cleanup completed');
  return cleanedContent;
}

/**
 * Очищает массив блоков от пустых элементов
 */
export function cleanupBlocksContent(blocks: any[]): any[] {
  console.log('[CleanupEmptyElements] Starting cleanup of blocks array');
  
  const cleanedBlocks = blocks.map(block => {
    if (!block || !block.content) {
      return block;
    }
    
    const cleanedContent = cleanupBlockContent(block.content);
    
    return {
      ...block,
      content: cleanedContent
    };
  });
  
  console.log('[CleanupEmptyElements] Blocks cleanup completed');
  return cleanedBlocks;
}
