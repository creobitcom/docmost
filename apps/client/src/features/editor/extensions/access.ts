import { Extension, mergeAttributes } from "@tiptap/core";

export const NoAccessExtension = Extension.create({
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
              return value === "true";
            },
            renderHTML: (attributes) => ({
              noaccess: attributes.noaccess,
            }),
            // if (!attributes[this.options.attributeName]) {
            //   return {};
            // }
            // return {
            //   [this.options.attributeName]: "true",
            //   "data-no-access-block": "true",
            //   class: `no-access-block`,
            //   style:
            //     "opacity: 0.5; pointer-events: none; position: relative;",
            // };
          },
        },
      },
    ];
  },
});
