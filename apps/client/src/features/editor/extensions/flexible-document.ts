import Document from '@tiptap/extension-document';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Гибкая версия Document, которая не требует обязательного параграфа
 * Основана на стандартном Document, но с измененным content правилом
 */
export const FlexibleDocument = Document.extend({
  name: 'doc',
  
  // Изменяем content с 'block+' на 'block*' - это позволяет пустые документы
  content: 'block*',
  
  // Временно отключаем плагин для предотвращения зависаний
  // addProseMirrorPlugins() {
  //   const plugins = Document.config.addProseMirrorPlugins?.call(this) || [];
  //   return plugins;
  // }
});

/**
 * Утилита для создания контента без принудительных параграфов
 */
export function createFlexibleContent(content: any[] = []) {
  // Если контент пустой, возвращаем пустой документ
  if (!content || content.length === 0) {
    return {
      type: 'doc',
      content: []
    };
  }
  
  // Фильтруем пустые параграфы
  const filteredContent = content.filter(node => {
    if (node.type === 'paragraph') {
      // Проверяем, есть ли в параграфе реальный контент
      if (!node.content || node.content.length === 0) {
        return false;
      }
      
      // Проверяем, есть ли текстовое содержимое
      const hasText = node.content.some((textNode: any) => 
        textNode.type === 'text' && textNode.text && textNode.text.trim().length > 0
      );
      
      return hasText;
    }
    
    return true;
  });
  
  return {
    type: 'doc',
    content: filteredContent
  };
}
