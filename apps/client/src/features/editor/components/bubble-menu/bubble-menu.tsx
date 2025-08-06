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
import { LinkSelector } from "@/features/editor/components/bubble-menu/link-selector.tsx";
import { useTranslation } from "react-i18next";
import { SearchMenu } from "./search-menu";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { getBlockPermissions } from "@/lib/api-client";

export interface BubbleMenuItem {
  name: string;
  isActive: () => boolean;
  command: () => void;
  icon: typeof IconBold;
}

type EditorBubbleMenuProps = Omit<BubbleMenuProps, "children" | "editor"> & {
  editor: ReturnType<typeof useEditor>;
};

export const EditorBubbleMenu: FC<EditorBubbleMenuProps> = (props) => {
  const { t } = useTranslation();
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [, setDraftCommentId] = useAtom(draftCommentIdAtom);
  const [currentUser] = useAtom(currentUserAtom);
  const showCommentPopupRef = useRef(showCommentPopup);
  
  // Состояние для SearchMenu
  const [searchModalOpened, setSearchModalOpened] = useState(false);
  const [userBlockPermission, setUserBlockPermission] = useState<string | null>(null);
  const [isPageCreator, setIsPageCreator] = useState(false);

  useEffect(() => {
    showCommentPopupRef.current = showCommentPopup;
  }, [showCommentPopup]);

  // Получаем ID текущего блока из выделенного текста
  const getCurrentBlockId = (): string | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const blockElement = range.commonAncestorContainer.parentElement?.closest('[data-block-id]');
    return blockElement?.getAttribute('data-block-id') || null;
  };

  // Проверяем права пользователя на блок
  useEffect(() => {
    const checkUserPermissions = async () => {
      const blockId = getCurrentBlockId();
      if (!blockId || !currentUser?.user?.id) return;

      try {
        const permissions = await getBlockPermissions({ 
          pageId: props.editor.storage.pageId, 
          blockId 
        });
        const userPermission = permissions.data?.find(p => p.userId === currentUser.user.id);
        setUserBlockPermission(userPermission?.role || null);
      } catch (e) {
        console.error("Failed to check user permissions:", e);
      }
    };

    checkUserPermissions();
  }, [currentUser?.user?.id, props.editor.storage.pageId]);

  const items: BubbleMenuItem[] = [
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

  const commentItem: BubbleMenuItem = {
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
    tippyOptions: {
      moveTransition: "transform 0.15s ease-out",
      onHide: () => {
        setIsNodeSelectorOpen(false);
        setIsTextAlignmentOpen(false);
        setIsColorSelectorOpen(false);
        setIsLinkSelectorOpen(false);
      },
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
                key={index}
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
        </ActionIcon.Group>

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

        {/* Кнопка управления правами доступа к блоку */}
        {(userBlockPermission === "owner" || userBlockPermission === "edit" || isPageCreator) && (
          <Tooltip label="Управление правами доступа" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              radius="0"
              aria-label="Управление правами доступа"
              style={{ border: "none" }}
              onClick={() => setSearchModalOpened(true)}
            >
              <IconSearch size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Модальное окно управления правами доступа */}
      <SearchMenu
        opened={searchModalOpened}
        onClose={() => setSearchModalOpened(false)}
        pageId={props.editor.storage.pageId}
      />
    </BubbleMenu>
  );
};
