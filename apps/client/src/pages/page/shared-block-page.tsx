// src/pages/page/shared-block-page.tsx
import { useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { useYDoc } from '@/hooks/use-ydoc'
import api from '@/lib/api-client'
import { ReadOnlyBlockExtension } from '@/features/editor/extensions/read-only-extension'

// Типизация ответа API
interface SharedBlockResponse {
  block: { content: any }
  permission: string
  showMeta: boolean
}

export default function SharedBlockPage() {
  const { blockId } = useParams()
  const { search } = useLocation()
  const token = new URLSearchParams(search).get('t')

  // запрос блока
  const { data, isLoading } = useQuery<SharedBlockResponse>({
    queryKey: ['shared-block', blockId, token],
    queryFn: () => api.get(`/block/${blockId}`, { params: { t: token } }).then(r => r.data),
    enabled: !!blockId && !!token,
  })

  if (isLoading || !data) return <p>Loading ...</p>

  const typedData = data as SharedBlockResponse
  const { block, permission, showMeta } = typedData
  const ydoc = useYDoc(`shadow-block:${blockId}`)

  const editor = useEditor({
    content: block.content,
    editable: permission === 'edit',
    extensions: [
      StarterKit,
      Collaboration.configure({ document: ydoc }),
      ReadOnlyBlockExtension,
    ],
  })

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      {showMeta && <h3>{blockId}</h3>}
      <EditorContent editor={editor} />
    </div>
  )
}
