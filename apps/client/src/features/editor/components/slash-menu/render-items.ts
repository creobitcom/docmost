import { ReactRenderer, useEditor } from "@tiptap/react";
import CommandList from "@/features/editor/components/slash-menu/command-list";
import tippy from "tippy.js";

const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: any | null = null;

  return {
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      console.log('🎯 [RenderItems] onStart called with props:', props);
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        console.log('⚠️ [RenderItems] No clientRect provided');
        return;
      }

      // @ts-ignore
      popup = tippy("body", {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
      });
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup &&
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      console.log('🎯 [RenderItems] onKeyDown called with key:', props.event.key);

      if (props.event.key === "Escape") {
        console.log('🎯 [RenderItems] Escape key - hiding popup');
        popup?.[0].hide();
        return true;
      }

      console.log('🎯 [RenderItems] Forwarding key event to CommandList component');
      console.log('🎯 [RenderItems] Component ref:', component?.ref);

      // Проверяем, что ref существует и имеет метод onKeyDown
      if (component?.ref && typeof (component.ref as any).onKeyDown === 'function') {
        const result = (component.ref as any).onKeyDown(props);
        console.log('🎯 [RenderItems] CommandList onKeyDown result:', result);
        return result;
      } else {
        console.warn('🎯 [RenderItems] Component ref or onKeyDown method not found');
        return false;
      }
    },
    onExit: () => {
      if (popup && !popup[0].state.isDestroyed) {
        popup[0].destroy();
      }

      if (component) {
        component.destroy();
      }
    },
  };
};

export default renderItems;
