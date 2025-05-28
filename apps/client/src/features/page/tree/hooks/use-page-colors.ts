import { useAtom } from "jotai";
import { IPage } from "@/features/page/types/page.types";
import {
  getPageColorAtom,
  updatePageColorAtom,
} from "@/features/page/tree/atoms/tree-color-atom";

export function usePageColors() {
  const [, setPageColor] = useAtom(updatePageColorAtom);
  const [getPageColor] = useAtom(getPageColorAtom);
  const colors = ["#4CAF50", "#2196F3", "#9C27B0", "#FF9800", "#E91E63"];

  const loadColors = (pages: IPage[]) => {
    pages.forEach((page) => {
      if (page.parentPageId !== null) {
        console.log(page.parentPageId);
        setPageColor({
          pageId: page.id,
          color: getPageColor(page.parentPageId),
        });
        return;
      }

      const color =
        page.color ?? colors[Math.floor(Math.random() * colors.length)];
      setPageColor({ pageId: page.id, color });
    });
  };

  return { loadColors };
}
