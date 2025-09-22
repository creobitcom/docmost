// DnD tokens and styles for drag and drop functionality

export const dndTokens = {
  // MIME types
  BLOCK_MIME: 'application/docmost-block',
  ELEMENT_MIME: 'application/docmost-element',
  CROSS_BLOCK_MIME: 'application/docmost-cross-block',
  
  // CSS classes
  DRAGGING_CLASS: 'dragging',
  DROP_ZONE_CLASS: 'drop-zone',
  DROP_INDICATOR_CLASS: 'drop-indicator',
  DRAG_HANDLE_CLASS: 'drag-handle',
  
  // Data attributes
  BLOCK_ID_ATTR: 'data-block-id',
  ELEMENT_ID_ATTR: 'data-element-id',
  DRAG_HANDLE_ATTR: 'data-drag-handle',
} as const;

export const dndStyles = `
  .dragging {
    opacity: 0.5;
    transform: rotate(2deg);
  }
  
  .drop-zone {
    background: rgba(59, 130, 246, 0.1);
    border: 2px dashed #3b82f6;
    border-radius: 4px;
  }
  
  .drop-indicator {
    transition: all 0.2s ease;
  }
  
  .drag-handle {
    transition: opacity 0.2s ease;
  }
  
  .drag-handle:hover {
    opacity: 1;
  }
  
  .element-dragging {
    cursor: grabbing !important;
  }
  
  .block-dragging {
    cursor: grabbing !important;
  }
`;
