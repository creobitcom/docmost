import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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
    const hasContent = node.content.childCount > 0;

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-block-group": "true",
        class: "block-group",
      }),
      0,
      // hasContent ? 0 : ["p", { class: "is-empty is-editor-empty" }, 0],
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
            content: [
              {
                type: "paragraph",
                content: ["asdas"],
              },
            ],
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
