import { Extension } from '@tiptap/core';
import { Selection } from 'prosemirror-state';
import { slashMenuPluginKey } from './slash-command';

// ===== HELPER FUNCTIONS =====
function handleEnterInList(editor: any, $from: any, listItemType: string, options: ComprehensiveKeyboardHandlerOptions): boolean {
  const { state } = editor;
  const listItemNode = $from.parent;
  const isAtEnd = $from.pos === $from.end();
  
  // Более точное определение пустого элемента списка
  const isEmpty = listItemNode.content.size <= 2;
  
  // Дополнительная проверка: если элемент списка содержит только пустой параграф
  const hasOnlyEmptyParagraph = listItemNode.content.size === 2 && 
    listItemNode.content.firstChild?.type.name === 'paragraph' &&
    listItemNode.content.firstChild?.content.size === 0;

  console.log('[ComprehensiveKeyboardHandler] List item info:', {
    isAtEnd,
    isEmpty,
    hasOnlyEmptyParagraph,
    contentSize: listItemNode.content.size,
    pos: $from.pos,
    end: $from.end()
  });

  // Выход из списка при Enter в пустом элементе
  if ((isEmpty || hasOnlyEmptyParagraph) && isAtEnd) {
    console.log('[ComprehensiveKeyboardHandler] Empty list item at end - exiting list');
    
    const tr = state.tr;
    const listItemPos = $from.before($from.depth);
    const listPos = $from.before($from.depth - 1);
    const listNode = state.doc.nodeAt(listPos);
    
    if (listNode && listNode.childCount === 1) {
      // Если это последний элемент в списке, удаляем весь список
      console.log('[ComprehensiveKeyboardHandler] Deleting entire list (last item)');
      tr.delete(listPos, listPos + listNode.nodeSize);
    } else {
      // Удаляем только элемент списка
      console.log('[ComprehensiveKeyboardHandler] Deleting single list item');
      tr.delete(listItemPos, listItemPos + listItemNode.nodeSize);
    }
    
    // Применяем изменения в документе
    editor.view.dispatch(tr);
    
    // НЕ создаем новый блок автоматически - пользователь может сам решить, нужен ли ему новый блок
    
    return true;
  } 
  // Создание нового элемента списка в конце
  else if (isAtEnd) {
    console.log('[ComprehensiveKeyboardHandler] At end of list item - creating new list item');
    
    const tr = state.tr;
    
    // Проверяем, что мы можем создать новый элемент списка
    if (!listItemNode.type || !state.schema.nodes.paragraph) {
      console.warn('[ComprehensiveKeyboardHandler] Cannot create new list item - missing node types');
      return false;
    }
    
    try {
      const paragraph = state.schema.nodes.paragraph.create();
      const newListItem = listItemNode.type.create(null, paragraph);
      
      // Проверяем, что позиция для вставки корректна
      const insertPos = $from.pos + 1;
      if (insertPos > tr.doc.content.size) {
        console.warn('[ComprehensiveKeyboardHandler] Insert position out of bounds:', insertPos, 'doc size:', tr.doc.content.size);
        return false;
      }
      
      tr.insert(insertPos, newListItem);
      
      // Проверяем, что можем установить селекцию
      const newPos = insertPos + 1;
      if (newPos <= tr.doc.content.size) {
        tr.setSelection(Selection.near(tr.doc.resolve(newPos)));
      }
      
      editor.view.dispatch(tr);
      return true;
    } catch (error) {
      console.error('[ComprehensiveKeyboardHandler] Error creating new list item:', error);
      return false;
    }
  } 
  // Разделение элемента списка в середине
  else {
    console.log('[ComprehensiveKeyboardHandler] In middle of list item - splitting');
    
    const tr = state.tr;
    
    // Проверяем, что мы можем создать новый элемент списка
    if (!listItemNode.type || !state.schema.nodes.paragraph) {
      console.warn('[ComprehensiveKeyboardHandler] Cannot split list item - missing node types');
      return false;
    }
    
    try {
      const paragraph = state.schema.nodes.paragraph.create();
      const newListItem = listItemNode.type.create(null, paragraph);
      
      // Проверяем, что можем разделить в текущей позиции
      if ($from.pos >= tr.doc.content.size) {
        console.warn('[ComprehensiveKeyboardHandler] Split position out of bounds:', $from.pos, 'doc size:', tr.doc.content.size);
        return false;
      }
      
      tr.split($from.pos);
      
      // Проверяем позицию для вставки после разделения
      const insertPos = $from.pos + 1;
      if (insertPos <= tr.doc.content.size) {
        tr.insert(insertPos, newListItem);
        
        // Проверяем, что можем установить селекцию
        const newPos = insertPos + 1;
        if (newPos <= tr.doc.content.size) {
          tr.setSelection(Selection.near(tr.doc.resolve(newPos)));
        }
      }
      
      editor.view.dispatch(tr);
      return true;
    } catch (error) {
      console.error('[ComprehensiveKeyboardHandler] Error splitting list item:', error);
      return false;
    }
  }
}

function handleBackspaceInList(editor: any, $from: any, listItemType: string, options: ComprehensiveKeyboardHandlerOptions): boolean {
  const { state } = editor;

  // Проверяем, находимся ли мы в начале элемента списка
  if ($from.parentOffset === 0) {
    const listItem = $from.node($from.depth - 1);
    if (listItem && (listItem.type.name === 'listItem' || listItem.type.name === 'taskItem')) {
      const listPos = $from.before($from.depth - 1);
      const listNode = state.doc.nodeAt(listPos);
      
      if (listNode && listNode.childCount === 1) {
        console.log('[ComprehensiveKeyboardHandler] Last item in list - deleting entire list block');
        
        // Если это последний элемент в списке, удаляем весь блок списка
        const tr = state.tr;
        tr.delete(listPos, listPos + listNode.nodeSize);
        editor.view.dispatch(tr);
        
        // НЕ создаем новый блок автоматически - пользователь может сам решить, нужен ли ему новый блок
        
        return true;
      } else {
        // Если это не последний элемент, удаляем только текущий элемент списка
        console.log('[ComprehensiveKeyboardHandler] Deleting single list item');
        const tr = state.tr;
        const listItemPos = $from.before($from.depth - 1);
        tr.delete(listItemPos, listItemPos + listItem.nodeSize);
        editor.view.dispatch(tr);
        return true;
      }
    }
  }

  return false;
}

export interface ComprehensiveKeyboardHandlerOptions {
  onCreateBlockAfter?: () => void;
  onDeleteBlock?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateToFirst?: () => void;
  onNavigateToLast?: () => void;
  canDeleteBlock?: (block: any, allBlocks: any[]) => boolean;
  allBlocks?: any[];
  currentBlock?: any;
}

export const ComprehensiveKeyboardHandler = Extension.create<ComprehensiveKeyboardHandlerOptions>({
  name: 'comprehensiveKeyboardHandler',

  addOptions() {
    return {
      onCreateBlockAfter: null,
      onDeleteBlock: null,
      onNavigateUp: null,
      onNavigateDown: null,
      onNavigateToFirst: null,
      onNavigateToLast: null,
      canDeleteBlock: null,
      allBlocks: [],
      currentBlock: null,
    };
  },

  addKeyboardShortcuts() {
    return {
      // ===== ENTER KEY HANDLING =====
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;
        
        // Дополнительная проверка через DOM
        const slashMenuElement = document.querySelector('.slash-menu, [data-suggestion-list]') as HTMLElement;
        const isSlashMenuVisible = slashMenuElement && slashMenuElement.style.display !== 'none';
        
        const isSlashMenuReallyActive = isSlashMenuActive || isSlashMenuVisible;

        if (isSlashMenuReallyActive) {
          return false; // Позволяем slash menu обработать Enter
        }

        // ===== ENTER В СПИСКАХ =====
        // Проверяем, находимся ли мы в списке
        let inList = false;
        let listItemType = null;
        for (let i = 0; i <= $from.depth; i++) {
          const node = $from.node(i);
          if (node.type.name === 'list_item' || node.type.name === 'listItem' || 
              node.type.name === 'task_item' || node.type.name === 'taskItem') {
            inList = true;
            listItemType = node.type.name;
            break;
          }
        }

        if (inList) {
          return handleEnterInList(editor, $from, listItemType, this.options);
        }

        // ===== ENTER В ТАБЛИЦАХ =====
        if (parentType === 'table_cell' || parentType === 'table_header') {
          // Позволяем TipTap обработать создание новой строки таблицы
          return false;
        }

        // ===== ENTER В ЗАГОЛОВКАХ =====
        if (parentType === 'heading') {
          if (this.options.onCreateBlockAfter) {
            this.options.onCreateBlockAfter();
            return true;
          }
          return false;
        }

        // ===== ENTER В ПАРАГРАФАХ =====
        if (parentType === 'paragraph') {
          console.log('[ComprehensiveKeyboardHandler] Enter in paragraph, offset:', $from.parentOffset, 'size:', $from.parent.content.size);
          
          // Enter в конце параграфа создаёт новый блок
          if ($from.parentOffset === $from.parent.content.size) {
            console.log('[ComprehensiveKeyboardHandler] Enter at end of paragraph - creating new block');
            if (this.options.onCreateBlockAfter) {
              this.options.onCreateBlockAfter();
              return true;
            }
          }
          // Enter в начале пустого параграфа создаёт новый блок
          else if ($from.parentOffset === 0 && $from.parent.content.size === 0) {
            console.log('[ComprehensiveKeyboardHandler] Enter in empty paragraph - creating new block');
            if (this.options.onCreateBlockAfter) {
              this.options.onCreateBlockAfter();
              return true;
            }
          }
          // Enter в середине параграфа разделяет его на два блока
          else if ($from.parentOffset < $from.parent.content.size) {
            console.log('[ComprehensiveKeyboardHandler] Enter in middle of paragraph - creating new block');
            if (this.options.onCreateBlockAfter) {
              this.options.onCreateBlockAfter();
              return true;
            }
          }
        }

        return false;
      },

      // ===== BACKSPACE KEY HANDLING =====
      Backspace: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;
        
        if (isSlashMenuActive) {
          return false; // Позволяем slash menu обработать Backspace
        }

        // ===== BACKSPACE С ВЫДЕЛЕННЫМ КОНТЕНТОМ =====
        // Если есть выделенный текст, позволяем стандартному поведению TipTap
        if (!selection.empty) {
          return false; // Позволяем TipTap удалить выделенный контент
        }

        // ===== BACKSPACE В СПИСКАХ =====
        // Проверяем, находимся ли мы в списке
        let inList = false;
        let listItemType = null;
        for (let i = 0; i <= $from.depth; i++) {
          const node = $from.node(i);
          if (node.type.name === 'list_item' || node.type.name === 'listItem' || 
              node.type.name === 'task_item' || node.type.name === 'taskItem') {
            inList = true;
            listItemType = node.type.name;
            break;
          }
        }

        if (inList) {
          return handleBackspaceInList(editor, $from, listItemType, this.options);
        }

        // ===== BACKSPACE В ПУСТЫХ ПАРАГРАФАХ =====
        if (parentType === 'paragraph' && $from.parent.content.size === 0) {
          // Проверяем, можно ли удалить этот блок
          if (this.options.canDeleteBlock && this.options.currentBlock && this.options.allBlocks) {
            const canDelete = this.options.canDeleteBlock(this.options.currentBlock, this.options.allBlocks);
            
            if (!canDelete) {
              console.warn('Cannot delete the last block on the page');
              return false; // Предотвращаем удаление
            }

            if (this.options.onDeleteBlock) {
              this.options.onDeleteBlock();
              return true;
            }
          }
        }

        // ===== BACKSPACE В НАЧАЛЕ ПАРАГРАФА =====
        if (parentType === 'paragraph' && $from.parentOffset === 0) {
          // Если это не первый блок, переходим к предыдущему
          if (this.options.onNavigateUp) {
            this.options.onNavigateUp();
            return true;
          }
        }

        return false;
      },

      // ===== DELETE KEY HANDLING =====
      Delete: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;
        
        if (isSlashMenuActive) {
          return false; // Позволяем slash menu обработать Delete
        }

        // ===== DELETE С ВЫДЕЛЕННЫМ КОНТЕНТОМ =====
        // Если есть выделенный текст, позволяем стандартному поведению TipTap
        if (!selection.empty) {
          return false; // Позволяем TipTap удалить выделенный контент
        }

        // ===== DELETE В КОНЦЕ ПАРАГРАФА =====
        if (parentType === 'paragraph' && $from.parentOffset === $from.parent.content.size) {
          // Если это не последний блок, переходим к следующему
          if (this.options.onNavigateDown) {
            this.options.onNavigateDown();
            return true;
          }
        }

        return false;
      },

      // ===== ARROW KEYS FOR NAVIGATION =====
      ArrowUp: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;
        
        if (isSlashMenuActive) {
          return false; // Позволяем slash menu обработать ArrowUp
        }

        // Навигация между блоками (только для параграфов и заголовков)
        if (parentType === 'paragraph' || parentType === 'heading') {
          // В начале блока - переходим к предыдущему блоку
          if ($from.parentOffset === 0) {
            if (this.options.onNavigateUp) {
              this.options.onNavigateUp();
              return true;
            }
          }
        }

        return false;
      },

      ArrowDown: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;
        
        if (isSlashMenuActive) {
          return false; // Позволяем slash menu обработать ArrowDown
        }

        // Навигация между блоками (только для параграфов и заголовков)
        if (parentType === 'paragraph' || parentType === 'heading') {
          // В конце блока - переходим к следующему блоку
          if ($from.parentOffset === $from.parent.content.size) {
            if (this.options.onNavigateDown) {
              this.options.onNavigateDown();
              return true;
            }
          }
        }

        return false;
      },

      // ===== CTRL+ARROW KEYS FOR QUICK NAVIGATION =====
      'Ctrl-Home': ({ editor }) => {
        const { state, view } = editor;
        
        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;
        
        if (isSlashMenuActive) {
          return false;
        }

        if (this.options.onNavigateToFirst) {
          this.options.onNavigateToFirst();
          return true;
        }

        return false;
      },

      'Ctrl-End': ({ editor }) => {
        const { state, view } = editor;
        
        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;
        
        if (isSlashMenuActive) {
          return false;
        }

        if (this.options.onNavigateToLast) {
          this.options.onNavigateToLast();
          return true;
        }

        return false;
      },
    };
  },

});
