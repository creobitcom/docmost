import { EditorView } from '@tiptap/pm/view';
import { Transaction } from '@tiptap/pm/state';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface DropData {
  type: 'block' | 'element';
  id: string;
  sourceBlockId?: string;
  data?: any;
}

export interface DropTarget {
  type: 'blockBoundary' | 'listItem' | 'blockContent';
  pos: number;
  after: boolean;
  blockId?: string;
}

export class DropHandler {
  constructor(private view: EditorView) {}

  static parseDropData(view: EditorView, event: DragEvent): DropData | null {
    try {
      const textData = event.dataTransfer?.getData('text/plain');
      if (!textData) return null;

      const parsed = JSON.parse(textData);
      return parsed;
    } catch (error) {
      console.error('[DropHandler] Error parsing drop data:', error);
      return null;
    }
  }

  static resolveDropTarget(view: EditorView, event: DragEvent): DropTarget | null {
    try {
      const coords = { left: event.clientX, top: event.clientY };
      const pos = view.posAtCoords(coords);
      
      if (!pos) return null;

      const $pos = view.state.doc.resolve(pos.pos);
      const node = $pos.node();

      // Determine drop target type
      if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
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
      console.error('[DropHandler] Error resolving drop target:', error);
      return null;
    }
  }

  handleDrop(dropData: DropData, dropTarget: DropTarget): boolean {
    try {
      const tr = this.view.state.tr;

      if (dropData.type === 'block') {
        return this.handleBlockDrop(tr, dropData, dropTarget);
      } else if (dropData.type === 'element') {
        return this.handleElementDrop(tr, dropData, dropTarget);
      }

      return false;
    } catch (error) {
      console.error('[DropHandler] Error handling drop:', error);
      return false;
    }
  }

  private handleBlockDrop(tr: Transaction, dropData: DropData, dropTarget: DropTarget): boolean {
    try {
      const blockPos = this.findBlockPosition(dropData.id);
      if (blockPos === null) return false;

      const block = this.view.state.doc.nodeAt(blockPos);
      if (!block) return false;

      const targetPos = dropTarget.after ? dropTarget.pos + 1 : dropTarget.pos;
      
      tr.delete(blockPos, blockPos + block.nodeSize);
      tr.insert(targetPos, block);
      
      this.view.dispatch(tr);
      return true;
    } catch (error) {
      console.error('[DropHandler] Error handling block drop:', error);
      return false;
    }
  }

  private handleElementDrop(tr: Transaction, dropData: DropData, dropTarget: DropTarget): boolean {
    try {
      const elementPos = this.findElementPosition(dropData.id);
      if (elementPos === null) return false;

      const element = this.view.state.doc.nodeAt(elementPos);
      if (!element) return false;

      const targetPos = dropTarget.after ? dropTarget.pos + 1 : dropTarget.pos;
      
      tr.delete(elementPos, elementPos + element.nodeSize);
      tr.insert(targetPos, element);
      
      this.view.dispatch(tr);
      return true;
    } catch (error) {
      console.error('[DropHandler] Error handling element drop:', error);
      return false;
    }
  }

  private findBlockPosition(blockId: string): number | null {
    let foundPos: number | null = null;
    
    this.view.state.doc.descendants((node, pos) => {
      if (node.attrs && node.attrs.blockId === blockId) {
        foundPos = pos;
        return false;
      }
    });
    
    return foundPos;
  }

  private findElementPosition(elementId: string): number | null {
    let foundPos: number | null = null;
    
    this.view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
        const nodeElementId = `element-${pos}-${node.type.name}`;
        if (nodeElementId === elementId) {
          foundPos = pos;
          return false;
        }
      }
    });
    
    return foundPos;
  }
}

// Export standalone function for compatibility
export function handleDrop(): boolean {
  return false; // Placeholder implementation
}
