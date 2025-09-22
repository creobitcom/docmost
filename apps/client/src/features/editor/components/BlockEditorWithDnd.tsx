import React from 'react';
import { Editor } from '@tiptap/react';
import { BlockHandle } from './drag-handle/block-handle';
import { ElementHandle } from './drag-handle/element-handle';
import { DropIndicator } from './drag-handle/drop-indicator';

interface BlockEditorWithDndProps {
  editor: Editor | null;
  blockId: string;
  onBlockMove?: (fromPos: number, toPos: number, after: boolean) => void;
  onElementMove?: (fromPos: number, toPos: number, after: boolean) => void;
}

export const BlockEditorWithDnd: React.FC<BlockEditorWithDndProps> = ({
  editor,
  blockId,
  onBlockMove,
  onElementMove,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragType, setDragType] = React.useState<'block' | 'element' | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{
    pos: number;
    after: boolean;
  } | null>(null);

  const handleDragStart = React.useCallback((type: 'block' | 'element', id: string) => {
    setIsDragging(true);
    setDragType(type);
    console.log('[BlockEditorWithDnd] Drag start:', { type, id, blockId });
  }, [blockId]);

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
    setDragType(null);
    setDropTarget(null);
    console.log('[BlockEditorWithDnd] Drag end');
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    if (!isDragging) return;

    e.preventDefault();
    
    // Calculate drop position based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    const after = y > height / 2;
    const pos = after ? height : 0;
    
    setDropTarget({ pos, after });
  }, [isDragging]);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    if (!dropTarget) return;

    const dragData = e.dataTransfer?.getData('text/plain');
    if (!dragData) return;

    try {
      const parsed = JSON.parse(dragData);
      
      if (parsed.type === 'block' && onBlockMove) {
        onBlockMove(0, dropTarget.pos, dropTarget.after);
      } else if (parsed.type === 'element' && onElementMove) {
        onElementMove(0, dropTarget.pos, dropTarget.after);
      }
    } catch (error) {
      console.error('[BlockEditorWithDnd] Error parsing drop data:', error);
    }

    handleDragEnd();
  }, [dropTarget, onBlockMove, onElementMove, handleDragEnd]);

  return (
    <div
      className="block-editor-with-dnd"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* Block Drag Handle */}
      <BlockHandle
        blockId={blockId}
        onDragStart={(id) => handleDragStart('block', id)}
        onDragEnd={handleDragEnd}
      />

      {/* Element Drag Handles */}
      {editor && (
        <ElementHandles
          editor={editor}
          blockId={blockId}
          onDragStart={(id) => handleDragStart('element', id)}
          onDragEnd={handleDragEnd}
        />
      )}

      {/* Drop Indicators */}
      {isDragging && dropTarget && (
        <>
          <DropIndicator
            position={dropTarget.after ? 'bottom' : 'top'}
            visible={true}
          />
        </>
      )}
    </div>
  );
};

interface ElementHandlesProps {
  editor: Editor;
  blockId: string;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

const ElementHandles: React.FC<ElementHandlesProps> = ({
  editor,
  blockId,
  onDragStart,
  onDragEnd,
}) => {
  const [elements, setElements] = React.useState<Array<{
    id: string;
    pos: number;
    type: string;
  }>>([]);

  React.useEffect(() => {
    const updateElements = () => {
      const newElements: Array<{ id: string; pos: number; type: string }> = [];
      
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
          newElements.push({
            id: `element-${pos}-${node.type.name}`,
            pos,
            type: node.type.name,
          });
        }
      });
      
      setElements(newElements);
    };

    updateElements();
    
    const handleUpdate = () => updateElements();
    editor.on('update', handleUpdate);
    
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  return (
    <>
      {elements.map((element) => (
        <ElementHandle
          key={element.id}
          elementId={element.id}
          blockId={blockId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </>
  );
};
