import { Extension } from "@tiptap/core";
import { BlockTypes } from "../editor.namespace";

export const BlockAttributes = Extension.create({
  name: "blockAttributes",

  addGlobalAttributes() {
    return [
      {
        types: BlockTypes,
        attributes: {
          position: {
            default: null,
            parseHTML: (element) => element.getAttribute("position"),
            renderHTML: (attributes) => ({
              position: attributes.position,
            }),
          },
        },
      },
    ];
  },
});
