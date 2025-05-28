import { atom } from "jotai";

export const pageColorAtom = atom(new Map<string, string>());

export const updatePageColorAtom = atom(
  null,
  (get, set, { pageId, color }: { pageId: string; color: string }) => {
    const newMap = new Map(get(pageColorAtom));
    newMap.set(pageId, color);
    set(pageColorAtom, newMap);
  },
);

export const getPageColorAtom = atom(
  (get) => (key: string) => get(pageColorAtom).get(key),
);
