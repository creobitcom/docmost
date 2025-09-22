import { EditorView } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export type DragKind = 'block' | 'element';

export interface ListContext {
  listPos: number;
  liPos: number;
  listType: string;
  liType: string;
}

export interface DragData {
  kind: DragKind;
  pos: number;
  node: ProseMirrorNode;
  list?: ListContext;
}

export function resolveNodeFromDom(element: HTMLElement, view: EditorView): DragData | null {
  try {
    const pos = view.posAtDOM(element, 0);
    if (pos === null) return null;
    
    const node = view.state.doc.nodeAt(pos);
    if (!node) return null;
    
    // Determine if it's a block or element
    const kind: DragKind = node.type.name === 'listItem' || node.type.name === 'taskItem' ? 'element' : 'block';
    
    const dragData: DragData = {
      kind,
      pos,
      node,
    };
    
    // Add list context for elements
    if (kind === 'element') {
      const listContext = findListContext(view.state.doc, pos);
      if (listContext) {
        dragData.list = listContext;
      }
    }
    
    return dragData;
  } catch (error) {
    console.error('[PMAdapter] Error resolving node from DOM:', error);
    return null;
  }
}

export function toDragData(node: ProseMirrorNode, pos: number): DragData {
  const kind: DragKind = node.type.name === 'listItem' || node.type.name === 'taskItem' ? 'element' : 'block';
  
  const dragData: DragData = {
    kind,
    pos,
    node,
  };
  
  return dragData;
}

export function getNodeRect(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect();
}

export function resolveListItemAtDom(element: HTMLElement, view: EditorView): { pos: number; node: ProseMirrorNode } | null {
  try {
    const pos = view.posAtDOM(element, 0);
    if (pos === null) return null;
    
    const node = view.state.doc.nodeAt(pos);
    if (!node || (node.type.name !== 'listItem' && node.type.name !== 'taskItem')) {
      return null;
    }
    
    return { pos, node };
  } catch (error) {
    console.error('[PMAdapter] Error resolving list item from DOM:', error);
    return null;
  }
}

function findListContext(doc: ProseMirrorNode, pos: number): ListContext | null {
  try {
    let listPos: number | null = null;
    let liPos: number | null = null;
    let listType = '';
    let liType = '';
    
    doc.nodesBetween(0, doc.content.size, (node, nodePos) => {
      if (node.type.name === 'bulletList' || node.type.name === 'orderedList' || node.type.name === 'taskList') {
        if (pos >= nodePos && pos <= nodePos + node.nodeSize) {
          listPos = nodePos;
          listType = node.type.name;
        }
      }
      
      if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
        if (pos >= nodePos && pos <= nodePos + node.nodeSize) {
          liPos = nodePos;
          liType = node.type.name;
        }
      }
    });
    
    if (listPos !== null && liPos !== null) {
      return {
        listPos,
        liPos,
        listType,
        liType,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[PMAdapter] Error finding list context:', error);
    return null;
  }
}
