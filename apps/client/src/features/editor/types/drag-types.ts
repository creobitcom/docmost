/**
 * Типы для системы drag-and-drop
 */

export interface UnifiedDragData {
  version: string;
  type: 'element' | 'block';
  blockId: string;
  elementId?: string;
  sourceHandle: 'element' | 'global';
  timestamp: number;
  sourceBlockData?: any;
}

export interface ElementData {
  elementId: string;
  blockId: string;
  type: string;
}

// DragState интерфейс перенесен в drag-state-manager.ts для избежания дублирования
