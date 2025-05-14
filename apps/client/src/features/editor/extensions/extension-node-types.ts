import { Extension } from "@tiptap/core"
import { mainExtensions } from "./extensions"

/**
 * Extracts unique extension names (typically node/mark types) from a list of extensions.
 */
export const getExtensionNodeTypes = (extensions: Extension[] | any[]): string[] => {
  const nodeTypes = new Set<string>()

  for (const ext of extensions) {
    try {
      // Direct name (e.g. paragraph, heading, etc.)
      if (ext.name) {
        nodeTypes.add(ext.name)
      }

      // Fallback for nested extensions (e.g., from .configure().extend())
      if (ext.extension?.name) {
        nodeTypes.add(ext.extension.name)
      }
    } catch (e) {
      console.warn("Unable to extract name from extension", ext, e)
    }
  }

  return Array.from(nodeTypes)
}
