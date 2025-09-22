import React from 'react';
import { EditorView } from 'prosemirror-view';
import { EnhancedDndProvider } from './enhanced-dnd-provider';
import { EnhancedBlockHandle } from './enhanced-block-handle';

interface EditorWithDndProps {
  children: React.ReactNode;
  view?: EditorView;
  blockId?: string;
  onBlockDrop?: (sourceBlockId: string, targetBlockId: string, position: 'before' | 'after') => void;
  onElementDrop?: (sourceElementId: string, targetElementId: string, position: 'before' | 'after') => void;
}

export const EditorWithDnd: React.FC<EditorWithDndProps> = ({
  children,
  view,
  blockId,
  onBlockDrop,
  onElementDrop,
}) => {
  return (
    <EnhancedDndProvider view={view}>
      <EnhancedBlockHandle
        blockId={blockId || 'default-block'}
        view={view}
        onBlockDrop={onBlockDrop}
        onElementDrop={onElementDrop}
      >
        {children}
      </EnhancedBlockHandle>
    </EnhancedDndProvider>
  );
};
