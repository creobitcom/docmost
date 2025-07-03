// src/hooks/use-ydoc.ts   (или куда вам удобнее)
import { useMemo } from 'react'
import * as Y from 'yjs'
// ИЛИ, если у вас websocket‑сервер y-websocket:
import { WebsocketProvider } from 'y-websocket'

export function useYDoc(room: string) {
  return useMemo(() => {
    const doc = new Y.Doc()
    /* eslint-disable no-new */
    new WebsocketProvider(import.meta.env.VITE_COLLAB_WS, room, doc)
    // либо  new WebrtcProvider(room, doc)
    return doc
  }, [room])
}
