export interface IPageBlock {
    id: string; // Unique identifier for the block
    type: string; // The type of the block (e.g., 'text', 'image', 'video', etc.)
    content: any; // The content of the block (e.g., text, link, image, etc.)
    parentId?: string; // For nested blocks (optional)
    createdAt: string; // The creation time of the block
    updatedAt: string; // The last update time of the block
  }

  // If blocks can be of different types, you can add specific type definitions for each block:
  export interface ITextBlock extends IPageBlock {
    type: 'text'; // The block type is 'text'
    content: string; // The content of the text block
  }

  export interface IImageBlock extends IPageBlock {
    type: 'image'; // The block type is 'image'
    content: {
      src: string; // The URL of the image
      alt: string; // The alt text for the image
    };
  }
