import { Extension } from '@tiptap/core'
import { v4 as uuidv4 } from 'uuid'
import { BlockTypes } from '../editor.namespace';

export const BlockAttributes = Extension.create({
  name: 'blockAttributes',

  // addGlobalCommands() {
  //   return {
  //     types: BlockTypes,
  //     onCreate:
  //       (attrs: any) =>
  //       ({ commands }) => {
  //         return commands.insertContent({
  //           attrs: { ...attrs, "test": () => uuidv4() },
  //         });
  //       },
  //   };
  // },

  addGlobalAttributes() {
    return [
      {
        types: BlockTypes,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => {
              return element.getAttribute('blockId')
            },
            renderHTML: (attributes) => ({
              blockId: attributes.blockId,
            }),
          },
          position: {
            // default: Math.floor(Math.random() * 10000) + 1,
            default: null,
            parseHTML: (element) => element.getAttribute('position'),
            renderHTML: (attributes) => ({
              position: attributes.position,
            }),
          },
        },
        // commands: {
        //   // onCreate:
        //   //   (attrs: any) =>
        //   //   ({ commands }) => {
        //   //     return commands.insertContent({
        //   //       attrs: { ...attrs, "test": () => uuidv4() },
        //   //     });
        //   //   },
        // }
        
    },]
  },
})
