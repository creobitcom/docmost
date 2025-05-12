/*import { Extension, type Node as ProseMirrorNode } from '@tiptap/core'
import { v4 as uuidv4 } from "uuid"
export interface UniqueIdOptions {
  types: string[]
  attributeName: string
  createId: () => string
}

export const UniqueId = Extension.create<UniqueIdOptions>({
  name: 'uniqueId',

  addOptions() {
    return {
      types: ["paragraph", "heading", "orderedList", "bulletList"],
      attributeName: 'id',
      createId: () => uuidv4(),
    }
  },

  addGlobalAttributes() {
    return this.options.types.map((type) => ({
      types: [type],
      attributes: {
        [this.options.attributeName]: {
          default: null,
          parseHTML: (element) => element.getAttribute(this.options.attributeName),
          renderHTML: (attributes) => {
            if (!attributes[this.options.attributeName]) {
              return {}
            }

            return {
              [this.options.attributeName]: attributes[this.options.attributeName],
            }
          },
        },
      },
    }))
  },
})
*/