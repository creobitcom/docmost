import {
  BubbleMenu,
  BubbleMenuProps,
  isNodeSelection,
  useEditor,
} from "@tiptap/react";
import { FC, useEffect, useRef, useState } from "react";
import {
  IconBold,
  IconCode,
  IconItalic,
  IconStrikethrough,
  IconUnderline,
  IconMessage,
  IconSearch,
} from "@tabler/icons-react";
import clsx from "clsx";
import classes from "./bubble-menu.module.css";
import { ActionIcon, rem, Tooltip } from "@mantine/core";
import { ColorSelector } from "./color-selector";
import { NodeSelector } from "./node-selector";
import { TextAlignmentSelector } from "./text-alignment-selector";
import {
  draftCommentIdAtom,
  showCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import { useAtom } from "jotai";
import { v7 as uuid7 } from "uuid";
import { isCellSelection, isTextSelected } from "@docmost/editor-ext";
import { LinkSelector } from "@/features/editor/components/bubble-menu/link-selector";
import { useTranslation } from "react-i18next";
import { ContextMenu } from "./ContextMenu";
import { SearchMenu } from "./SearchMenu";

type EditorBubbleMenuProps = Omit<BubbleMenuProps, "children" | "editor"> & {
  editor: ReturnType<typeof useEditor>;
};

// ...импорты остаются без изменений

export const EditorBubbleMenu: FC<EditorBubbleMenuProps> = (props) => {
  const { t } = useTranslation();
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [, setDraftCommentId] = useAtom(draftCommentIdAtom);
  const showCommentPopupRef = useRef(showCommentPopup);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);




  useEffect(() => {
    showCommentPopupRef.current = showCommentPopup;
  }, [showCommentPopup]);

  const items = [
    {
      name: "Bold",
      isActive: () => props.editor.isActive("bold"),
      command: () => props.editor.chain().focus().toggleBold().run(),
      icon: IconBold,
    },
    {
      name: "Italic",
      isActive: () => props.editor.isActive("italic"),
      command: () => props.editor.chain().focus().toggleItalic().run(),
      icon: IconItalic,
    },
    {
      name: "Underline",
      isActive: () => props.editor.isActive("underline"),
      command: () => props.editor.chain().focus().toggleUnderline().run(),
      icon: IconUnderline,
    },
    {
      name: "Strike",
      isActive: () => props.editor.isActive("strike"),
      command: () => props.editor.chain().focus().toggleStrike().run(),
      icon: IconStrikethrough,
    },
    {
      name: "Code",
      isActive: () => props.editor.isActive("code"),
      command: () => props.editor.chain().focus().toggleCode().run(),
      icon: IconCode,
    },
  ];

  const handleContextAction = (action: string) => {
    if (action === "Block ID") {
      const { state } = props.editor;
      const { selection } = state;

      let foundNode = null;

      state.doc.descendants((node, pos) => {
        if (
          pos <= selection.from &&
          selection.to <= pos + node.nodeSize &&
          node.attrs?.id
        ) {
          foundNode = node;
          return false;
        }
        return true;
      });

      if (foundNode?.attrs?.id) {
        console.log("Block ID:", foundNode.attrs.id);
      } else {
        console.log("ID not found for selected block");
      }
    }
  };

  const commentItem = {
    name: "Comment",
    isActive: () => props.editor.isActive("comment"),
    command: () => {
      const commentId = uuid7();

      props.editor.chain().focus().setCommentDecoration().run();
      setDraftCommentId(commentId);
      setShowCommentPopup(true);
    },
    icon: IconMessage,
  };

  const bubbleMenuProps: EditorBubbleMenuProps = {
    ...props,
    shouldShow: ({ state, editor }) => {
      const { selection } = state;
      const { empty } = selection;

      if (
        !editor.isEditable ||
        editor.isActive("image") ||
        empty ||
        isNodeSelection(selection) ||
        isCellSelection(selection) ||
        showCommentPopupRef?.current
      ) {
        return false;
      }
      return isTextSelected(editor);
    },
  };

  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [isTextAlignmentSelectorOpen, setIsTextAlignmentOpen] = useState(false);
  const [isColorSelectorOpen, setIsColorSelectorOpen] = useState(false);
  const [isLinkSelectorOpen, setIsLinkSelectorOpen] = useState(false);

  return (
    <BubbleMenu {...bubbleMenuProps}>
      <div className={classes.bubbleMenu}>
        <NodeSelector
          editor={props.editor}
          isOpen={isNodeSelectorOpen}
          setIsOpen={() => {
            setIsNodeSelectorOpen(!isNodeSelectorOpen);
            setIsTextAlignmentOpen(false);
            setIsColorSelectorOpen(false);
            setIsLinkSelectorOpen(false);
          }}
        />

        <TextAlignmentSelector
          editor={props.editor}
          isOpen={isTextAlignmentSelectorOpen}
          setIsOpen={() => {
            setIsTextAlignmentOpen(!isTextAlignmentSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsColorSelectorOpen(false);
            setIsLinkSelectorOpen(false);
          }}
        />

        <ActionIcon.Group>
          {items.map((item, index) => (
            <Tooltip key={index} label={t(item.name)} withArrow>
              <ActionIcon
                variant="default"
                size="lg"
                radius="0"
                aria-label={t(item.name)}
                className={clsx({ [classes.active]: item.isActive() })}
                style={{ border: "none" }}
                onClick={item.command}
              >
                <item.icon style={{ width: rem(16) }} stroke={2} />
              </ActionIcon>
            </Tooltip>
          ))}

          <ContextMenu
            isOpen={isContextMenuOpen}
            setIsOpen={setIsContextMenuOpen}
            onSelect={handleContextAction}
            editor={props.editor}
          />

        </ActionIcon.Group>

        {showSearch && (
          <div
            style={{
              marginTop: "8px",
              background: "white",
              border: "1px solid #ccc",
              padding: "8px",
              borderRadius: "4px",
              width: "200px",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
            }}
          >
            <input
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        )}

        <LinkSelector
          editor={props.editor}
          isOpen={isLinkSelectorOpen}
          setIsOpen={() => {
            setIsLinkSelectorOpen(!isLinkSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsTextAlignmentOpen(false);
            setIsColorSelectorOpen(false);
          }}
        />

        <ColorSelector
          editor={props.editor}
          isOpen={isColorSelectorOpen}
          setIsOpen={() => {
            setIsColorSelectorOpen(!isColorSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsTextAlignmentOpen(false);
            setIsLinkSelectorOpen(false);
          }}
        />

        <ActionIcon
          variant="default"
          size="lg"
          radius="0"
          aria-label={t(commentItem.name)}
          style={{ border: "none" }}
          onClick={commentItem.command}
        >
          <IconMessage size={16} stroke={2} />
        </ActionIcon>
        <Tooltip label="Search Users" withArrow>
  <ActionIcon
    variant="default"
    size="lg"
    radius="0"
    aria-label="Search"
    style={{ border: "none" }}
    onClick={() => {
      setIsSearchOpen((prev) => !prev);
      setIsColorSelectorOpen(false);
      setIsLinkSelectorOpen(false);
      setIsNodeSelectorOpen(false);
      setIsTextAlignmentOpen(false);
    }}
    ref={searchButtonRef}
  >
    <IconSearch size={16} stroke={2} />
  </ActionIcon>
</Tooltip>

{isSearchOpen && (
  <div
    style={{
      position: "absolute",
      top: "100%",
      left: 0,
      zIndex: 10,
      backgroundColor: "white",
      border: "1px solid #ccc",
      borderRadius: "4px",
      padding: "8px",
      marginTop: "8px",
      boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
      width: "250px",
    }}
  >
    <SearchMenu
      onSelect={(user) => {
        console.log("Выбран пользователь:", user);
        setIsSearchOpen(false);
      }}
    />
  </div>
)}

      </div>
    </BubbleMenu>
  );
};

