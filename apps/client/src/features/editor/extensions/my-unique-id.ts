import {
  Extension as t,
  findChildren as e,
  combineTransactionSteps as r,
  getChangedRanges as n,
  findChildrenInRange as i,
  findDuplicates as o,
  findDuplicates,
} from "@tiptap/core";

import { Plugin as a, PluginKey as s } from "@tiptap/pm/state";

import { Slice as d, Fragment as p } from "@tiptap/pm/model";

const u = new t({
  name: "unique-id",
  priority: 99999,

  addOptions: () => ({
    attributeName: "id",
    types: [],
    createId: () => window.crypto.randomUUID(),
  }),

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (el) => el.getAttribute(this.options.attributeName),
            renderHTML: (attrs) =>
              attrs[this.options.attributeName]
                ? {
                    [this.options.attributeName]:
                      attrs[this.options.attributeName],
                  }
                : {},
          },
        },
      },
    ];
  },

  onCreate() {
    const { tr, doc } = this.editor.state;
    const { types, attributeName, createId } = this.options;

    for (const { node, pos } of e(
      doc,
      (node) =>
        types.includes(node.type.name) && node.attrs[attributeName] == null,
    )) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        [attributeName]: createId(),
      });
    }

    this.editor.view.dispatch(tr);
  },

  addProseMirrorPlugins() {
    let dragContainer = null;
    let wasDropOrPaste = false;
    const options = this.options;

    return [
      new a({
        key: new s("unique-id"),

        appendTransaction: (transactions, oldState, newState) => {
          const { doc: oldDoc } = oldState;
          const { doc: newDoc, tr } = newState;

          if (!transactions.some((tx) => tx.docChanged) || oldDoc.eq(newDoc))
            return;

          const { types, attributeName, createId } = this.options;
          const combinedSteps = r(oldDoc, [...transactions]);

          for (const { newRange } of n(combinedSteps)) {
            const nodes = i(newDoc, newRange, (node) =>
              types.includes(node.type.name),
            );
            const existingIds = nodes
              .map(({ node }) => node.attrs[attributeName])
              .filter((id) => id !== null);

            for (const { node, pos } of nodes) {
              const currentId = tr.doc.nodeAt(pos)?.attrs[attributeName];

              if (currentId === null) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  [attributeName]: createId(),
                });
                continue;
              }

              // TODO: fix ids
              const previousPos = combinedSteps.mapping
                .invert()
                .mapResult(pos).pos;
              const previousNode = oldDoc.nodeAt(previousPos);

              if (
                findDuplicates(existingIds).includes(currentId) &&
                (!previousNode ||
                  previousNode.attrs[attributeName] !== currentId)
              ) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  [attributeName]: createId(),
                });
              }
            }
          }

          return tr.steps.length ? tr : undefined;
        },

        view(editorView) {
          const onDragStart = (event) => {
            dragContainer = editorView.dom.parentElement?.contains(event.target)
              ? editorView.dom.parentElement
              : null;
          };

          window.addEventListener("dragstart", onDragStart);

          return {
            destroy() {
              window.removeEventListener("dragstart", onDragStart);
            },
          };
        },

        props: {
          handleDOMEvents: {
            drop(view, event) {
              if (
                dragContainer !== view.dom.parentElement ||
                event.dataTransfer?.effectAllowed === "copy"
              ) {
                dragContainer = null;
                wasDropOrPaste = true;
              }
              return false;
            },

            paste() {
              wasDropOrPaste = true;
              return false;
            },
          },

          transformPasted(slice) {
            if (!wasDropOrPaste) return slice;

            const { types, attributeName } = options;

            const transformFragment = (fragment) => {
              const children = [];

              fragment.forEach((child) => {
                if (child.isText) {
                  children.push(child);
                } else if (!types.includes(child.type.name)) {
                  children.push(child.copy(transformFragment(child.content)));
                } else {
                  children.push(
                    child.type.create(
                      {
                        ...child.attrs,
                        [attributeName]: null,
                      },
                      transformFragment(child.content),
                      child.marks,
                    ),
                  );
                }
              });

              return p.from(children);
            };

            wasDropOrPaste = false;

            return new d(
              transformFragment(slice.content),
              slice.openStart,
              slice.openEnd,
            );
          },
        },
      }),
    ];
  },
});

export { u as default };
