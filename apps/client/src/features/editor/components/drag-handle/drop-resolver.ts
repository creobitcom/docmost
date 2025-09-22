import { EditorView } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface DropTarget {
  type: 'blockBoundary' | 'listItem' | 'blockContent' | 'betweenBlocks';
  pos: number;
  after: boolean;
  blockId?: string;
  elementId?: string;
}

export function resolveDropTargetFromPoint(
  view: EditorView,
  clientX: number,
  clientY: number
): DropTarget | null {
  try {
    const coords = { left: clientX, top: clientY };
    const pos = view.posAtCoords(coords);
    
    if (!pos) return null;

    const $pos = view.state.doc.resolve(pos.pos);
    const node = $pos.node();
    const parent = $pos.parent;

    // Check if we're between blocks
    if (isBetweenBlocks(view, pos.pos)) {
      return {
        type: 'betweenBlocks',
        pos: pos.pos,
        after: true,
      };
    }

    // Determine drop target type based on node type
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      return {
        type: 'listItem',
        pos: pos.pos,
        after: !pos.inside,
        elementId: `element-${pos.pos}-${node.type.name}`,
      };
    } else if (parent && (parent.type.name === 'bulletList' || parent.type.name === 'orderedList' || parent.type.name === 'taskList')) {
      return {
        type: 'listItem',
        pos: pos.pos,
        after: !pos.inside,
      };
    } else {
      return {
        type: 'blockBoundary',
        pos: pos.pos,
        after: !pos.inside,
      };
    }
  } catch (error) {
    console.error('[DropResolver] Error resolving drop target:', error);
    return null;
  }
}

function isBetweenBlocks(view: EditorView, pos: number): boolean {
  try {
    const $pos = view.state.doc.resolve(pos);
    const node = $pos.node();
    const parent = $pos.parent;

    // Check if we're at a block boundary
    if (node.type.name === 'doc' && parent) {
      return true;
    }

    // Check if we're between different block types
    const prevNode = pos > 0 ? view.state.doc.nodeAt(pos - 1) : null;
    const nextNode = pos < view.state.doc.content.size ? view.state.doc.nodeAt(pos + 1) : null;

    if (prevNode && nextNode) {
      const prevIsBlock = isBlockNode(prevNode);
      const nextIsBlock = isBlockNode(nextNode);
      
      if (prevIsBlock && nextIsBlock && prevNode.type.name !== nextNode.type.name) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[DropResolver] Error checking between blocks:', error);
    return false;
  }
}

function isBlockNode(node: ProseMirrorNode): boolean {
  const blockTypes = [
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'taskList',
    'blockquote',
    'codeBlock',
    'horizontalRule',
  ];
  
  return blockTypes.includes(node.type.name);
}

export function resolveDropTargetFromElement(
  view: EditorView,
  element: HTMLElement
): DropTarget | null {
  try {
    const pos = view.posAtDOM(element, 0);
    if (pos === null) return null;

    const $pos = view.state.doc.resolve(pos);
    const node = $pos.node();

    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      return {
        type: 'listItem',
        pos: pos,
        after: false,
        elementId: `element-${pos}-${node.type.name}`,
      };
    } else {
      return {
        type: 'blockBoundary',
        pos: pos,
        after: false,
      };
    }
  } catch (error) {
    console.error('[DropResolver] Error resolving drop target from element:', error);
    return null;
  }
}
