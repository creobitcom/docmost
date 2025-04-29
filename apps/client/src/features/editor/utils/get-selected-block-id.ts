import { Editor } from "@tiptap/react";


//block's id's parsing function
export const getSelectedBlockId = (editor: Editor): string | null => {
    const { state } = editor;
    const { selection } = state;
    const fromPos = selection.from;

    let foundNode: any = null;

    state.doc.nodesBetween(fromPos, fromPos, (node) => {
      if (node.attrs?.id) {
        foundNode = node;
        return false;
      }
      return true;
    });

    return foundNode?.attrs?.id || null;
  };