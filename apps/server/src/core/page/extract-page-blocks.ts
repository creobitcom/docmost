import { v4 as uuidv4 } from 'uuid';

function generateUniqueId() {
  return uuidv4();
}

function extractTextFromContent(content: any[]): string {
  if (!Array.isArray(content)) return '';

  return content
    .map((node: any) => {
      if (node.type === 'text' && typeof node.text === 'string') {
        return node.text;
      } else if (Array.isArray(node.content)) {
        return extractTextFromContent(node.content);
      }
      return '';
    })
    .join('');
}

export function extractTopLevelBlocks(content: any, pageId: string) {
  if (!Array.isArray(content.content)) return [];

  return content.content
    .filter((block: any) => block.type)
    .map((block: any) => {
      if (!block.attrs) block.attrs = {};
      if (!block.attrs.id) {
        block.attrs.id = generateUniqueId();
      }

      const textContent = extractTextFromContent(block.content);

      return {
        blockId: block.attrs.id,
        blockType: block.type,
        attrs: block.attrs,
        pageId: pageId,
        content: textContent || null,
      };
    });
}
