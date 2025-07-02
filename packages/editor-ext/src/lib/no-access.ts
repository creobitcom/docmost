import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface NoAccessOptions {
  attributeName: string;
  types: string[];
  themeMode: "light" | "dark";
  placeholderText: string;
}

export const NoAccessExtension = Extension.create<NoAccessOptions>({
  name: "no-access",
  addOptions: () => ({
    attributeName: "noaccess",
    types: [],
    themeMode: "light",
    placeholderText: "🔒 У вас нет доступа к этому блоку",
  }),

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: false,
            parseHTML: (element) => {
              const value = element.getAttribute(this.options.attributeName);
              console.log("Parsing HTML attribute:", value);
              return value === "true";
            },
            renderHTML: (attributes) => {
              if (!attributes[this.options.attributeName]) {
                return {};
              }
              return {
                [this.options.attributeName]: "true",
                style: "display: none;",
              };
            },
          },
        },
      },
    ];
  },

  // Maybe switch to a different approach with placeholder
  // addProseMirrorPlugins() {
  //   const options = this.options;

  //   return [
  //     new Plugin({
  //       key: new PluginKey("no-access-plugin"),
  //       props: {
  //         nodeViews: {
  //           ["paragraph"]: (node, view, getPos, decorations) => {
  //             if (!node.attrs?.noaccess) return null;

  //             const dom = document.createElement("div");
  //             dom.className = "placeholder-block";
  //             dom.textContent = "🔒 У вас нет доступа к этому блоку";

  //             return { dom };
  //           },
  //         },
  //       },
  //     }),
  //   ];
  // },
});
