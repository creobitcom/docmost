import { Node, mergeAttributes } from '@tiptap/core';

export const PlaceholderBlock = Node.create({
  name: 'placeholder',

  group: 'block',
  atom: true,

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
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-placeholder-block': 'true',
        class: 'placeholder-block',
      }),
      '🔒 У вас нет доступа к этому блоку',
    ];
  },
});
