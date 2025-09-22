/// <reference types="vite/client" />
declare const APP_VERSION: string

// Расширение типа Window для drag-and-drop состояния
declare global {
  interface Window {
    __dragState?: {
      potentialElementDrag?: boolean;
      currentElementId?: string;
      [key: string]: any;
    };
    __currentBlockId?: string;
    docmostDragState?: any;
  }
}