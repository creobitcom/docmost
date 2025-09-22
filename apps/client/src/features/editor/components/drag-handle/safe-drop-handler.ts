import { EditorView } from '@tiptap/pm/view';
import { Transaction } from '@tiptap/pm/state';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export function safeInsertNode(
  tr: Transaction,
  pos: number,
  node: ProseMirrorNode
): boolean {
  try {
    if (pos < 0 || pos > tr.doc.content.size) {
      console.warn('[SafeDropHandler] Position out of bounds:', pos);
      return false;
    }
    
    tr.insert(pos, node);
    return true;
  } catch (error) {
    console.error('[SafeDropHandler] Error inserting node:', error);
    return false;
  }
}

export function insertListItemSafe(
  tr: Transaction,
  pos: number,
  content: ProseMirrorNode[]
): boolean {
  try {
    if (pos < 0 || pos > tr.doc.content.size) {
      console.warn('[SafeDropHandler] Position out of bounds for list item:', pos);
      return false;
    }
    
    const listItem = tr.doc.type.schema.nodes.listItem.create({}, content);
    tr.insert(pos, listItem);
    return true;
  } catch (error) {
    console.error('[SafeDropHandler] Error inserting list item:', error);
    return false;
  }
}

export function atomicMoveNode(
  tr: Transaction,
  fromPos: number,
  toPos: number,
  nodeSize: number
): boolean {
  try {
    if (fromPos < 0 || fromPos + nodeSize > tr.doc.content.size) {
      console.warn('[SafeDropHandler] Source position out of bounds:', fromPos);
      return false;
    }
    
    if (toPos < 0 || toPos > tr.doc.content.size) {
      console.warn('[SafeDropHandler] Target position out of bounds:', toPos);
      return false;
    }
    
    const node = tr.doc.nodeAt(fromPos);
    if (!node) {
      console.warn('[SafeDropHandler] No node found at source position:', fromPos);
      return false;
    }
    
    // Delete from source
    tr.delete(fromPos, fromPos + nodeSize);
    
    // Insert at target
    tr.insert(toPos, node);
    
    return true;
  } catch (error) {
    console.error('[SafeDropHandler] Error moving node atomically:', error);
    return false;
  }
}

export function safeRemoveNode(
  tr: Transaction,
  pos: number,
  nodeSize: number
): boolean {
  try {
    if (pos < 0 || pos + nodeSize > tr.doc.content.size) {
      console.warn('[SafeDropHandler] Position out of bounds for removal:', pos);
      return false;
    }
    
    tr.delete(pos, pos + nodeSize);
    return true;
  } catch (error) {
    console.error('[SafeDropHandler] Error removing node:', error);
    return false;
  }
}

export function handleDrop(
  view: EditorView,
  event: DragEvent,
  dropTarget: { pos: number; after: boolean }
): boolean {
  try {
    const tr = view.state.tr;
    
    // Get drag data
    const dragData = event.dataTransfer?.getData('text/plain');
    if (!dragData) {
      console.warn('[SafeDropHandler] No drag data found');
      return false;
    }
    
    // Parse drag data
    let parsedData;
    try {
      parsedData = JSON.parse(dragData);
    } catch {
      console.warn('[SafeDropHandler] Failed to parse drag data:', dragData);
      return false;
    }
    
    // Handle different types of drops
    if (parsedData.type === 'element') {
      return handleElementDrop(view, tr, parsedData, dropTarget);
    } else if (parsedData.type === 'block') {
      return handleBlockDrop(view, tr, parsedData, dropTarget);
    }
    
    return false;
  } catch (error) {
    console.error('[SafeDropHandler] Error handling drop:', error);
    return false;
  }
}

function handleElementDrop(
  view: EditorView,
  tr: Transaction,
  dragData: any,
  dropTarget: { pos: number; after: boolean }
): boolean {
  try {
    // Find the element in the document
    const elementPos = findElementPosition(view.state.doc, dragData.elementId);
    if (elementPos === null) {
      console.warn('[SafeDropHandler] Element not found:', dragData.elementId);
      return false;
    }
    
    const element = view.state.doc.nodeAt(elementPos);
    if (!element) {
      console.warn('[SafeDropHandler] No element node found at position:', elementPos);
      return false;
    }
    
    // Calculate target position
    const targetPos = dropTarget.after ? dropTarget.pos + 1 : dropTarget.pos;
    
    // Move the element
    return atomicMoveNode(tr, elementPos, targetPos, element.nodeSize);
  } catch (error) {
    console.error('[SafeDropHandler] Error handling element drop:', error);
    return false;
  }
}

function handleBlockDrop(
  view: EditorView,
  tr: Transaction,
  dragData: any,
  dropTarget: { pos: number; after: boolean }
): boolean {
  try {
    // Find the block in the document
    const blockPos = findBlockPosition(view.state.doc, dragData.blockId);
    if (blockPos === null) {
      console.warn('[SafeDropHandler] Block not found:', dragData.blockId);
      return false;
    }
    
    const block = view.state.doc.nodeAt(blockPos);
    if (!block) {
      console.warn('[SafeDropHandler] No block node found at position:', blockPos);
      return false;
    }
    
    // Calculate target position
    const targetPos = dropTarget.after ? dropTarget.pos + 1 : dropTarget.pos;
    
    // Move the block
    return atomicMoveNode(tr, blockPos, targetPos, block.nodeSize);
  } catch (error) {
    console.error('[SafeDropHandler] Error handling block drop:', error);
    return false;
  }
}

function findElementPosition(doc: ProseMirrorNode, elementId: string): number | null {
  let foundPos: number | null = null;
  
  doc.descendants((node, pos) => {
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      const nodeElementId = `element-${pos}-${node.type.name}`;
      if (nodeElementId === elementId) {
        foundPos = pos;
        return false; // Stop searching
      }
    }
  });
  
  return foundPos;
}

function findBlockPosition(doc: ProseMirrorNode, blockId: string): number | null {
  let foundPos: number | null = null;
  
  doc.descendants((node, pos) => {
    if (node.attrs && node.attrs.blockId === blockId) {
      foundPos = pos;
      return false; // Stop searching
    }
  });
  
  return foundPos;
}
