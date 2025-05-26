import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockGroup: {
      setBlockGroup: () => ReturnType;
      toggleBlockGroup: () => ReturnType;
      unsetBlockGroup: () => ReturnType;
    };
  }
}

export const BlockGroup = Node.create({
  name: "blockGroup",

  group: "myBlocks",

  content: "block*",

  defining: true,

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-block-group]",
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-block-group": "true",
        class: "block-group",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setBlockGroup:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name);
        },
      toggleBlockGroup:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name);
        },
      unsetBlockGroup:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
      insertBlockGroup:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            content: [],
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-P": () => this.editor.commands.toggleBlockGroup(),
      "Mod-Shift-Enter": () => {
        return this.editor.commands.insertContent({
          type: this.name,
          content: [
            {
              type: "paragraph",
              content: [],
            },
          ],
        });
      },
    };
  },
});
