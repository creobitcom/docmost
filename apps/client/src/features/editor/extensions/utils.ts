import { Editor } from "@tiptap/react";

export const userColors = [
  "#958DF1",
  "#F98181",
  "#FBBC88",
  "#FAF594",
  "#70CFF8",
  "#94FADB",
  "#B9F18D",
];

export function randomElement(array: Array<any>) {
  return array[Math.floor(Math.random() * array.length)];
}

export { clsx as cn } from 'clsx'

export function focusBlockById(editor: Editor, blockId: string) {
  if (!editor) return;

  const pos = findBlockPosById(editor, blockId);
  if (pos !== null) {
    editor.chain().focus().setTextSelection(pos).run();

    const dom = editor.view.domAtPos(pos)?.node as HTMLElement;
    dom?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export function findBlockPosById(editor: Editor, blockId: string): number | null {
  let foundPos: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.attrs?.blockId === blockId) {
      foundPos = pos;
      return false;
    }
    return true;
  });

  return foundPos;
}