// import { Block } from "@/features/editor/types";

/**
 * Очищает пустые параграфы из содержимого блоков
 * Удаляет параграфы, которые содержат только пустой контент
 */
export function cleanupBlocksContent(blocks: any[]): any[] {
  return blocks.map(block => {
    if (!block.content || !Array.isArray(block.content)) {
      return block;
    }

    // Фильтруем пустые параграфы
    const cleanedContent = block.content.filter(node => {
      // Если это не параграф, оставляем как есть
      if (node.type !== 'paragraph') {
        return true;
      }

      // Если у параграфа нет контента или контент пустой
      if (!node.content || !Array.isArray(node.content) || node.content.length === 0) {
        return false;
      }

      // Если контент содержит только пустые текстовые узлы
      const hasNonEmptyContent = node.content.some(textNode => {
        if (textNode.type === 'text') {
          return textNode.text && textNode.text.trim().length > 0;
        }
        return true; // Не текстовые узлы считаем непустыми
      });

      return hasNonEmptyContent;
    });

    return {
      ...block,
      content: cleanedContent
    };
  });
}
