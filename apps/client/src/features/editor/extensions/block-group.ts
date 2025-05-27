import { mergeAttributes, Node } from "@tiptap/core";

export interface BlockGroupOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockGroup: {
      toggleBlockGroup: () => ReturnType;
      insertBlockGroup: () => ReturnType;
    };
  }
}

export const BlockGroup = Node.create<BlockGroupOptions>({
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

  renderHTML({ HTMLAttributes }) {
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
      toggleBlockGroup:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name);
        },
      insertBlockGroup:
        () =>
        ({ commands }) => {
          return commands.insertContent({
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
