import { Extension } from '@tiptap/core';
import { Selection } from 'prosemirror-state';
import { slashMenuPluginKey } from './slash-command';

// ===== HELPER FUNCTIONS =====
function handleEnterInList(editor: any, $from: any, listItemType: string, options: ComprehensiveKeyboardHandlerOptions): boolean {
  const { state } = editor;
  const listItemNode = $from.parent;
  const isAtEnd = $from.pos === $from.end();

  // Более точное определение пустого элемента списка
  // Элемент считается пустым только если он содержит только пустой параграф
  const hasOnlyEmptyParagraph = listItemNode.content.size === 2 &&
    listItemNode.content.firstChild?.type.name === 'paragraph' &&
    listItemNode.content.firstChild?.content.size === 0;

  // Элемент считается пустым только если он действительно не содержит текста
  // Проверяем как пустые параграфы, так и элементы без содержимого
  const isEmpty = hasOnlyEmptyParagraph || listItemNode.content.size === 0;

  console.log('[ComprehensiveKeyboardHandler] List item info:', {
    isAtEnd,
    isEmpty,
    hasOnlyEmptyParagraph,
    contentSize: listItemNode.content.size,
    pos: $from.pos,
    end: $from.end()
  });

  // Выход из списка при Enter в пустом элементе
  if (isEmpty && isAtEnd) {
    console.log('[ComprehensiveKeyboardHandler] Empty list item at end - exiting list');

    const tr = state.tr;
    const listItemPos = $from.before($from.depth);
    const listPos = $from.before($from.depth - 1);
    const listNode = state.doc.nodeAt(listPos);

    console.log('[ComprehensiveKeyboardHandler] List info:', {
      listItemPos,
      listPos,
      listNodeType: listNode?.type.name,
      listChildCount: listNode?.childCount,
      listNodeSize: listNode?.nodeSize
    });

    // При выходе из списка всегда удаляем элемент списка
    if (listNode && listNode.childCount === 1) {
      // Если это единственный элемент в списке, удаляем весь список и создаем новый блок
      console.log('[ComprehensiveKeyboardHandler] Only item in list - deleting list and creating new block');
      
      // Удаляем весь список
      tr.delete(listPos, listPos + listNode.nodeSize);
      
      // Применяем изменения
      editor.view.dispatch(tr);
      
      // Создаем новый блок после удаления списка
      if (options.onCreateBlockAfter) {
        console.log('[ComprehensiveKeyboardHandler] Creating new block after list deletion');
        setTimeout(() => {
          options.onCreateBlockAfter();
        }, 100);
      }
    } else {
      // Удаляем только элемент списка (если в списке несколько элементов)
      console.log('[ComprehensiveKeyboardHandler] Deleting single list item (multiple items in list)');
      tr.delete(listItemPos, listItemPos + listItemNode.nodeSize);

      // Применяем изменения в документе
      editor.view.dispatch(tr);
    }

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
      // Попробуем использовать встроенную команду TipTap для создания нового элемента списка
      if (editor.commands.splitListItem && listItemType) {
        console.log('[ComprehensiveKeyboardHandler] Using splitListItem command');
        const success = editor.commands.splitListItem(listItemType);
        if (success) {
          console.log('[ComprehensiveKeyboardHandler] New list item created successfully with splitListItem');
          return true;
        }
      }
      
      // Если команда не сработала, используем ручное создание
      console.log('[ComprehensiveKeyboardHandler] Using manual list item creation');
      
      // Создаем параграф с минимальным содержимым для нового элемента списка
      const paragraph = state.schema.nodes.paragraph.create({}, [
        state.schema.text(' ')
      ]);

      // Создаем новый элемент списка с параграфом
      const newListItem = listItemNode.type.create(null, paragraph);

      // Проверяем, что позиция для вставки корректна
      const insertPos = $from.pos + 1;
      if (insertPos > tr.doc.content.size) {
        console.warn('[ComprehensiveKeyboardHandler] Insert position out of bounds:', insertPos, 'doc size:', tr.doc.content.size);
        return false;
      }

      // Вставляем новый элемент списка
      tr.insert(insertPos, newListItem);

      // Устанавливаем селекцию в новый элемент списка
      const newPos = insertPos + 1;
      if (newPos <= tr.doc.content.size) {
        tr.setSelection(Selection.near(tr.doc.resolve(newPos)));
      }

      editor.view.dispatch(tr);
      console.log('[ComprehensiveKeyboardHandler] New list item created successfully manually');
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
      // Создаем пустой параграф для нового элемента списка
      const paragraph = state.schema.nodes.paragraph.create();

      // Создаем новый элемент списка с пустым параграфом
      const newListItem = listItemNode.type.create(null, paragraph);

      // Проверяем, что можем разделить в текущей позиции
      if ($from.pos >= tr.doc.content.size) {
        console.warn('[ComprehensiveKeyboardHandler] Split position out of bounds:', $from.pos, 'doc size:', tr.doc.content.size);
        return false;
      }

      // Разделяем элемент списка
      tr.split($from.pos);

      // Проверяем позицию для вставки после разделения
      const insertPos = $from.pos + 1;
      if (insertPos <= tr.doc.content.size) {
        tr.insert(insertPos, newListItem);

        // Устанавливаем селекцию в новый элемент списка
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

function handleBackspaceInList(editor: any, $from: any, listItemType: string, options: ComprehensiveKeyboardHandlerOptions): 'converted' | 'deleted' | false {
  const { state } = editor;

  // Проверяем, находимся ли мы в начале элемента списка
  if ($from.parentOffset === 0) {
    const listItem = $from.node($from.depth - 1);
    if (listItem && (listItem.type.name === 'listItem' || listItem.type.name === 'taskItem')) {
      try {
        // Безопасно получаем позицию списка
        let listPos = -1;
        let listNode = null;
        
        // Ищем родительский список, начиная с текущего уровня
        for (let i = $from.depth - 1; i >= 0; i--) {
          const node = $from.node(i);
          if (node.type.name === 'bulletList' || node.type.name === 'orderedList' || node.type.name === 'taskList') {
            listPos = $from.start(i);
            listNode = node;
            break;
          }
        }

        if (listPos === -1 || !listNode) {
          console.warn('[ComprehensiveKeyboardHandler] Could not find list position');
          return false;
        }

        // Определяем, является ли текущий элемент последним в списке
        const currentItemIndex = $from.index($from.depth - 1);
        const isLastItem = currentItemIndex === listNode.childCount - 1;
        const isOnlyItem = listNode.childCount === 1;

        console.log('[ComprehensiveKeyboardHandler] List item info:', {
          currentItemIndex,
          totalItems: listNode.childCount,
          isLastItem,
          isOnlyItem,
          listPos,
          listItemSize: listItem.nodeSize,
          listItemType: listItem.type.name,
          fromDepth: $from.depth,
          fromParentOffset: $from.parentOffset,
          fromPos: $from.pos
        });

        if (isLastItem || isOnlyItem) {
          // Если это последний элемент в списке, преобразуем в параграф
          console.log('[ComprehensiveKeyboardHandler] Last item in list - converting to paragraph');
          
          const tr = state.tr;
          const paragraph = state.schema.nodes.paragraph.create();
          tr.replaceWith(listPos, listPos + listNode.nodeSize, paragraph);

          // Устанавливаем курсор в начало параграфа
          const newPos = listPos + 1;
          if (newPos <= tr.doc.content.size) {
            tr.setSelection(Selection.near(tr.doc.resolve(newPos)));
          }

          // Применяем все изменения одной транзакцией
          editor.view.dispatch(tr);
          return 'converted';
        } else {
          // Если это не последний элемент, удаляем только текущий элемент списка
          console.log('[ComprehensiveKeyboardHandler] Deleting single list item (not last)');
          
          // Попробуем использовать команды TipTap для удаления элемента списка
          try {
            // Получаем позицию элемента списка относительно списка
            const listItemPos = $from.before($from.depth - 1);
            const listItemEndPos = listItemPos + listItem.nodeSize;
            
            console.log('[ComprehensiveKeyboardHandler] Deleting list item at positions:', {
              listItemPos,
              listItemEndPos,
              listItemSize: listItem.nodeSize,
              listItemType: listItem.type.name,
              fromBefore: $from.before($from.depth - 1),
              fromStart: $from.start($from.depth - 1),
              fromEnd: $from.end($from.depth - 1),
              fromPos: $from.pos,
              fromDepth: $from.depth
            });
            
            // Попробуем использовать встроенную команду liftListItem для удаления элемента списка
            if (editor.commands.liftListItem && listItemType === 'listItem') {
              console.log('[ComprehensiveKeyboardHandler] Using liftListItem command');
              const success = editor.commands.liftListItem(listItemType);
              if (success) {
                console.log('[ComprehensiveKeyboardHandler] List item lifted successfully');
                return 'deleted';
              }
            }
            
            // Если команда не сработала, используем ручное удаление
            console.log('[ComprehensiveKeyboardHandler] Using manual deletion');
            const tr = state.tr;
            tr.delete(listItemPos, listItemEndPos);
            
            // Применяем транзакцию
            editor.view.dispatch(tr);
            
            console.log('[ComprehensiveKeyboardHandler] List item deleted successfully');
            return 'deleted';
          } catch (error) {
            console.error('[ComprehensiveKeyboardHandler] Error deleting list item:', error);
            return false;
          }
        }
      } catch (error) {
        console.error('[ComprehensiveKeyboardHandler] Error in handleBackspaceInList:', error);
        return false;
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
        console.log('[ComprehensiveKeyboardHandler] Enter key pressed - handler called');
        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;
        const parentType = $from.parent.type.name;

        // Проверяем, активен ли slash menu
        const slashMenuState = slashMenuPluginKey.getState(state);
        const isSlashMenuActive = slashMenuState && slashMenuState.active;

        // Дополнительная проверка через DOM - ищем все возможные селекторы
        const slashMenuSelectors = [
          '#slash-command',
          '.slash-menu',
          '[data-suggestion-list]',
          '.tiptap-suggestion-list',
          '.suggestion-list',
          '.command-list',
          '[data-command-list]',
          '.tippy-box', // tippy.js popup
          '.tippy-content', // tippy.js content
          '[data-tippy-root]' // tippy.js root
        ];

        let slashMenuElement = null;
        for (const selector of slashMenuSelectors) {
          slashMenuElement = document.querySelector(selector) as HTMLElement;
          if (slashMenuElement) break;
        }

        const isSlashMenuVisible = slashMenuElement &&
          slashMenuElement.style.display !== 'none' &&
          slashMenuElement.style.visibility !== 'hidden' &&
          slashMenuElement.offsetParent !== null &&
          getComputedStyle(slashMenuElement).display !== 'none' &&
          getComputedStyle(slashMenuElement).visibility !== 'hidden';

        const isSlashMenuReallyActive = isSlashMenuActive || isSlashMenuVisible;

        console.log('[ComprehensiveKeyboardHandler] Slash menu check:', {
          isSlashMenuActive,
          isSlashMenuVisible,
          slashMenuElement: slashMenuElement ? {
            className: slashMenuElement.className,
            id: slashMenuElement.id,
            display: slashMenuElement.style.display,
            visibility: slashMenuElement.style.visibility,
            offsetParent: !!slashMenuElement.offsetParent
          } : null,
          isSlashMenuReallyActive
        });

        if (isSlashMenuReallyActive) {
          console.log('[ComprehensiveKeyboardHandler] Slash menu is active, allowing default behavior');
          console.log('[ComprehensiveKeyboardHandler] Returning false to let slash menu handle Enter');
          // Не обрабатываем Enter, позволяем slash menu обработать его
          return false;
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

        // Дополнительная проверка через DOM
        const slashMenuSelectors = [
          '#slash-command',
          '.slash-menu',
          '[data-suggestion-list]',
          '.tiptap-suggestion-list',
          '.suggestion-list',
          '.command-list',
          '[data-command-list]',
          '.tippy-box', // tippy.js popup
          '.tippy-content', // tippy.js content
          '[data-tippy-root]' // tippy.js root
        ];

        let slashMenuElement = null;
        for (const selector of slashMenuSelectors) {
          slashMenuElement = document.querySelector(selector) as HTMLElement;
          if (slashMenuElement) break;
        }
        const isSlashMenuVisible = slashMenuElement &&
          slashMenuElement.style.display !== 'none' &&
          slashMenuElement.style.visibility !== 'hidden' &&
          slashMenuElement.offsetParent !== null &&
          getComputedStyle(slashMenuElement).display !== 'none' &&
          getComputedStyle(slashMenuElement).visibility !== 'hidden';

        const isSlashMenuReallyActive = isSlashMenuActive || isSlashMenuVisible;

        console.log('[ComprehensiveKeyboardHandler] Backspace slash menu check:', {
          isSlashMenuActive,
          isSlashMenuVisible,
          slashMenuElement: slashMenuElement ? {
            className: slashMenuElement.className,
            id: slashMenuElement.id,
            display: slashMenuElement.style.display,
            visibility: slashMenuElement.style.visibility,
            offsetParent: !!slashMenuElement.offsetParent
          } : null,
          isSlashMenuReallyActive
        });

        if (isSlashMenuReallyActive) {
          console.log('[ComprehensiveKeyboardHandler] Slash menu is active, allowing default behavior for Backspace');
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
          const result = handleBackspaceInList(editor, $from, listItemType, this.options);
          if (result === 'converted') {
            console.log('[ComprehensiveKeyboardHandler] List item converted to paragraph, not deleting block');
            return true; // Обработано, не продолжаем
          } else if (result === 'deleted') {
            console.log('[ComprehensiveKeyboardHandler] List item deleted, not deleting block');
            return true; // Обработано, не продолжаем
          }
          // Если result === false, продолжаем обычную обработку
        }

        // ===== BACKSPACE В ПУСТЫХ ПАРАГРАФАХ =====
        if (parentType === 'paragraph' && $from.parent.content.size === 0) {
          // Проверяем, можно ли удалить этот блок (должны быть другие блоки на странице)
          if (this.options.canDeleteBlock && this.options.currentBlock && this.options.allBlocks) {
            const canDelete = this.options.canDeleteBlock(this.options.currentBlock, this.options.allBlocks);

            if (!canDelete) {
              console.log('[ComprehensiveKeyboardHandler] Cannot delete block - no other blocks on page');
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
