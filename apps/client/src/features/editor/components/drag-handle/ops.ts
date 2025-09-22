import { EditorView } from '@tiptap/pm/view';
import { Transaction } from '@tiptap/pm/state';
import { DragData, ListContext } from './pm-adapter';

export interface DropTarget {
  type: 'blockBoundary' | 'listItem' | 'blockContent';
  pos: number;
  after: boolean;
  blockId?: string;
}

export function executeDropOperation(
  view: EditorView, 
  dragData: DragData, 
  dropTarget: DropTarget
): boolean {
  try {
    const tr = view.state.tr;
    
    if (dragData.kind === 'block') {
      return moveBlock(view, dragData.pos, dropTarget.pos, dropTarget.after);
    } else if (dragData.kind === 'element' && dragData.list) {
      return moveListItem(view, dragData.list, dropTarget.pos, dropTarget.after);
    }
    
    return false;
  } catch (error) {
    console.error('[Ops] Error executing drop operation:', error);
    return false;
  }
}

export function moveBlock(
  view: EditorView, 
  fromPos: number, 
  toPos: number, 
  after: boolean
): boolean {
  try {
    const tr = view.state.tr;
    const fromNode = view.state.doc.nodeAt(fromPos);
    
    if (!fromNode) return false;
    
    // Calculate target position
    const targetPos = after ? toPos + 1 : toPos;
    
    // Move the block
    tr.delete(fromPos, fromPos + fromNode.nodeSize);
    tr.insert(targetPos, fromNode);
    
    view.dispatch(tr);
    return true;
  } catch (error) {
    console.error('[Ops] Error moving block:', error);
    return false;
  }
}

export function moveListItem(
  view: EditorView, 
  listContext: ListContext, 
  toPos: number, 
  after: boolean
): boolean {
  try {
    const tr = view.state.tr;
    const { liPos, listPos } = listContext;
    
    const listItem = view.state.doc.nodeAt(liPos);
    if (!listItem) return false;
    
    // Calculate target position
    const targetPos = after ? toPos + 1 : toPos;
    
    // Move the list item
    tr.delete(liPos, liPos + listItem.nodeSize);
    tr.insert(targetPos, listItem);
    
    view.dispatch(tr);
    return true;
  } catch (error) {
    console.error('[Ops] Error moving list item:', error);
    return false;
  }
}

export function embedIntoBlock(
  view: EditorView, 
  elementPos: number, 
  blockPos: number
): boolean {
  try {
    const tr = view.state.tr;
    const element = view.state.doc.nodeAt(elementPos);
    const block = view.state.doc.nodeAt(blockPos);
    
    if (!element || !block) return false;
    
    // Remove element from its current position
    tr.delete(elementPos, elementPos + element.nodeSize);
    
    // Insert into block content
    const blockEnd = blockPos + block.nodeSize - 1;
    tr.insert(blockEnd, element);
    
    view.dispatch(tr);
    return true;
  } catch (error) {
    console.error('[Ops] Error embedding into block:', error);
    return false;
  }
}

export function extractToNewBlock(
  view: EditorView, 
  elementPos: number, 
  afterBlockPos: number
): boolean {
  try {
    const tr = view.state.tr;
    const element = view.state.doc.nodeAt(elementPos);
    
    if (!element) return false;
    
    // Remove element from its current position
    tr.delete(elementPos, elementPos + element.nodeSize);
    
    // Create new block and insert element
    const newBlockPos = afterBlockPos + 1;
    tr.insert(newBlockPos, element);
    
    view.dispatch(tr);
    return true;
  } catch (error) {
    console.error('[Ops] Error extracting to new block:', error);
    return false;
  }
}
