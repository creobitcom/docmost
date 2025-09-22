import React, { memo } from 'react';
import { BlockEditor } from './block-editor';
import { PlaceholderBlock } from './placeholder-block';

interface BlockWrapperProps {
  block: any;
  editable: boolean;
  onBlockCreated: (block: any) => void;
  onBlockDeleted: (blockId: string) => void;
  allBlocks: any[];
  saveBlocksToServer: (pageId: string, blocks: any[]) => void;
  pageId: string;
  syncPageOriginId?: string | null;
  onFocus?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onCreateBlockAfter?: () => void;
  onCreateBlockAtEnd?: () => void;
  onDeleteBlock?: () => void;
  setBlockRef: (ref: any) => void;
}

export const BlockWrapper = memo<BlockWrapperProps>(({
  block,
  editable,
  onBlockCreated,
  onBlockDeleted,
  allBlocks,
  saveBlocksToServer,
  pageId,
  syncPageOriginId,
  onFocus,
  onNavigateUp,
  onNavigateDown,
  onCreateBlockAfter,
  onCreateBlockAtEnd,
  onDeleteBlock,
  setBlockRef
}) => {
  const blockEditable = block.userPermission === "edit" || block.userPermission === "owner";

  return block.hasAccess ? (
    <BlockEditor
      pageId={pageId}
      key={block.id}
      block={block}
      editable={blockEditable}
      onBlockCreated={onBlockCreated}
      onBlockDeleted={onBlockDeleted}
      allBlocks={allBlocks}
      saveBlocksToServer={saveBlocksToServer}
      onFocus={onFocus}
      onNavigateUp={onNavigateUp}
      onNavigateDown={onNavigateDown}
      onCreateBlockAfter={onCreateBlockAfter}
      onCreateBlockAtEnd={onCreateBlockAtEnd}
      onDeleteBlock={onDeleteBlock}
      ref={setBlockRef}
    />
  ) : (
    <PlaceholderBlock key={block.id} block={block} />
  );
});

BlockWrapper.displayName = 'BlockWrapper';


