import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphGroup: {
      setParagraphGroup: () => ReturnType;
      toggleParagraphGroup: () => ReturnType;
      unsetParagraphGroup: () => ReturnType;
    };
  }
}

export const ParagraphGroup = Node.create({
  name: "paragraphGroup",

  group: "block",

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
        tag: "div[data-paragraph-group]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-paragraph-group": "true" }),
      0,
    ];
  },

  addCommands() {
    return {
      setParagraphGroup:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name);
        },
      toggleParagraphGroup:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name);
        },
      unsetParagraphGroup:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-P": () => this.editor.commands.toggleParagraphGroup(),
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: ["paragraphGroup"],
        attributes: {
          textAlign: {
            default: "left",
            parseHTML: (element) => element.style.textAlign || "left",
            renderHTML: (attributes) => {
              if (!attributes.textAlign || attributes.textAlign === "left") {
                return {};
              }
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },
});
