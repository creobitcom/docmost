import {
  BubbleMenu,
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
import { ActionIcon, Button, Tooltip, rem } from "@mantine/core";
import { ColorSelector } from "./color-selector";
import { NodeSelector } from "./node-selector";
import { TextAlignmentSelector } from "./text-alignment-selector";
import { draftCommentIdAtom, showCommentPopupAtom } from "@/features/comment/atoms/comment-atom";
import { useAtom } from "jotai";
import { v7 as uuid7 } from "uuid";
import { isCellSelection, isTextSelected } from "@docmost/editor-ext";
import { LinkSelector } from "@/features/editor/components/bubble-menu/link-selector";
import { useTranslation } from "react-i18next";
import { ContextMenu } from "./context-menu";
import { SearchMenu } from "./search-menu";

type EditorBubbleMenuProps = {
  editor: ReturnType<typeof useEditor>;
  pageId: string;
};

export const EditorBubbleMenu: FC<EditorBubbleMenuProps> = ({ editor, pageId }) => {
  const { t } = useTranslation();
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [, setDraftCommentId] = useAtom(draftCommentIdAtom);

  const showCommentPopupRef = useRef(showCommentPopup);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchModalOpened, setSearchModalOpened] = useState(false);


  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [isTextAlignmentSelectorOpen, setIsTextAlignmentOpen] = useState(false);
  const [isColorSelectorOpen, setIsColorSelectorOpen] = useState(false);
  const [isLinkSelectorOpen, setIsLinkSelectorOpen] = useState(false);

  useEffect(() => {
    showCommentPopupRef.current = showCommentPopup;
  }, [showCommentPopup]);

  const items = [
    {
      name: "Bold",
      isActive: () => editor.isActive("bold"),
      command: () => editor.chain().focus().toggleBold().run(),
      icon: IconBold,
    },
    {
      name: "Italic",
      isActive: () => editor.isActive("italic"),
      command: () => editor.chain().focus().toggleItalic().run(),
      icon: IconItalic,
    },
    {
      name: "Underline",
      isActive: () => editor.isActive("underline"),
      command: () => editor.chain().focus().toggleUnderline().run(),
      icon: IconUnderline,
    },
    {
      name: "Strike",
      isActive: () => editor.isActive("strike"),
      command: () => editor.chain().focus().toggleStrike().run(),
      icon: IconStrikethrough,
    },
    {
      name: "Code",
      isActive: () => editor.isActive("code"),
      command: () => editor.chain().focus().toggleCode().run(),
      icon: IconCode,
    },
  ];


  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, state }) => {
        const { selection } = state;
        const { empty } = selection;

        if (
          !editor.isEditable ||
          editor.isActive("image") ||
          empty ||
          isNodeSelection(selection) ||
          isCellSelection(selection) ||
          showCommentPopupRef.current
        ) {
          return false;
        }
        return isTextSelected(editor);
      }}
    >
      <div className={classes.bubbleMenu}>
        <NodeSelector
          editor={editor}
          isOpen={isNodeSelectorOpen}
          setIsOpen={() => {
            setIsNodeSelectorOpen(!isNodeSelectorOpen);
            setIsTextAlignmentOpen(false);
            setIsColorSelectorOpen(false);
            setIsLinkSelectorOpen(false);
          }}
        />

        <TextAlignmentSelector
          editor={editor}
          isOpen={isTextAlignmentSelectorOpen}
          setIsOpen={() => {
            setIsTextAlignmentOpen(!isTextAlignmentSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsColorSelectorOpen(false);
            setIsLinkSelectorOpen(false);
          }}
        />

        <LinkSelector
          editor={editor}
          isOpen={isLinkSelectorOpen}
          setIsOpen={() => {
            setIsLinkSelectorOpen(!isLinkSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsTextAlignmentOpen(false);
            setIsColorSelectorOpen(false);
          }}
        />

        <ColorSelector
          editor={editor}
          isOpen={isColorSelectorOpen}
          setIsOpen={() => {
            setIsColorSelectorOpen(!isColorSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsTextAlignmentOpen(false);
            setIsLinkSelectorOpen(false);
          }}
        />

        <Tooltip label={t("Comment")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            aria-label={t("Comment")}
            style={{ border: "none" }}
            onClick={() => {
              const commentId = uuid7();
              editor.chain().focus().setCommentDecoration().run();
              setDraftCommentId(commentId);
              setShowCommentPopup(true);
            }}
          >
            <IconMessage size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Search Users" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            aria-label="Search"
            style={{ border: "none" }}
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
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
              marginTop: "8px",
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
              width: "250px",
              zIndex: 10,
            }}
          >
            <SearchMenu
              open={searchModalOpened}
              onClose={() => setSearchModalOpened(false)}
              editor={editor}
              pageId={pageId}
              onSelect={(user) => {
                console.log("Выбран пользователь:", user);
                setIsSearchOpen(false);
              }}
            />
            <Button onClick={() => setSearchModalOpened(true)}>Assign Permission</Button>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
};