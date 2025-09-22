import { Extension } from '@tiptap/core';

export interface BlockCreationCallback {
  (): void;
}

/**
 * Упрощенный SmartListHandler - теперь основная логика обработки клавиш
 * перенесена в ComprehensiveKeyboardHandler
 */
export const SmartListHandler = Extension.create({
  name: 'smartListHandler',

  addOptions() {
    return {
      onCreateBlockAfter: null as (() => void) | null,
    };
  },

  onCreate() {
    console.log('[SmartListHandler] Extension created and loaded');
  },

  // Убираем обработку клавиш - теперь это делает ComprehensiveKeyboardHandler
  addKeyboardShortcuts() {
    return {};
  },
});
