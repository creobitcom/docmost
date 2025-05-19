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
    .filter((block: any) => !!block.attrs?.id)
    .map((block: any) => {
      const textContent = extractTextFromContent(block.content);

      return {
        blockId: block.attrs.id,
        blockType: block.type,
        pageId,
        content: typeof textContent === 'string' ? textContent.trim() : '',
      };
    })
    .filter(block => block.content !== '');
}