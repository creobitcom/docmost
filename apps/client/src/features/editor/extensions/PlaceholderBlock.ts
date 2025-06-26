import { Node, mergeAttributes } from '@tiptap/core';

export const PlaceholderBlock = Node.create({
  name: 'placeholder',

  group: 'block',
  atom: true,

  addOptions() {
    return {
      themeMode: 'light', // default
    };
  },

  addAttributes() {
    return {
      id: { default: null },
      userPermission: { default: 'none' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-placeholder-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const themeClass = this.options.themeMode === 'dark'
      ? 'placeholder-block--dark'
      : 'placeholder-block--light';

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-placeholder-block': 'true',
        class: `placeholder-block ${themeClass}`,
      }),
      '🔒 У вас нет доступа к этому блоку',
    ];
  }
});
