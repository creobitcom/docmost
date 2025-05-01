import { atom } from "jotai";

export const colorAtom = atom<Record<string, string>>({});

export const spaceColorAtom = (spaceId: string) =>
  atom(
    (get) => {
      const colors = get(colorAtom);
      return colors[spaceId] || "#4CAF50";
    },
    (get, set, newColor: string) => {
      const colors = get(colorAtom);
      set(colorAtom, {
        ...colors,
        [spaceId]: newColor,
      });
    },
  );
