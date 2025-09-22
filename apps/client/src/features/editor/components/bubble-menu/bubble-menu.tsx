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
import { getBlockPermissions, getUserSpaceRole } from "@/lib/api-client";

export interface BubbleMenuItem {
  name: string;
  isActive: () => boolean;
  command: () => void;
  icon: typeof IconBold;
}

type EditorBubbleMenuProps = Omit<BubbleMenuProps, "children" | "editor"> & {
  editor: ReturnType<typeof useEditor>;
  pageId?: string;
  blockId?: string;
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
  const [hasAdminRights, setHasAdminRights] = useState(false);

  useEffect(() => {
    showCommentPopupRef.current = showCommentPopup;
  }, [showCommentPopup]);

  // Получаем ID текущего блока из выделенного текста
  const getCurrentBlockId = (): string | null => {
    // Приоритет: используем props.blockId если он есть
    if (props.blockId) {
      return props.blockId;
    }
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const blockElement = range.commonAncestorContainer.parentElement?.closest('[data-block-id]');
    return blockElement?.getAttribute('data-block-id') || null;
  };

      // Проверяем права пользователя на блок и статус создателя
    useEffect(() => {
      const checkUserPermissions = async () => {
        const blockId = getCurrentBlockId();
        const pageId = (props.pageId ?? props.editor.storage.pageId) as string | undefined;

        if (!blockId || !currentUser?.user?.id || !pageId) {
          setUserBlockPermission(null);
          setIsPageCreator(false);
          setHasAdminRights(false);
          return;
        }

      try {
        // Проверяем права на блок
        const result = await getBlockPermissions({
          pageId,
          blockId
        });
        const currentUserPermission = result.data?.find(item => item.userId === currentUser.user.id);
        setUserBlockPermission(currentUserPermission?.role || null);

        // Проверяем, является ли пользователь создателем страницы
        const pageResponse = await fetch(`/api/pages/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pageId }),
        });

        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          const pageInfo = pageData.data;

          // Проверяем разные варианты имени поля creator
          const creatorId = pageInfo?.creatorId || pageInfo?.creatorId || pageInfo?.creator?.id;
          const isCreator = creatorId === currentUser?.user?.id;
          setIsPageCreator(isCreator);

          // Проверяем права администратора
          const userRole = currentUser?.user?.role;
          const hasOwnerRole = userRole === 'owner';
          const hasAdminRole = userRole === 'admin';

          // Получаем роль пользователя в пространстве
          let hasSpaceAdminRights = false;
          if (pageInfo?.spaceId && currentUser?.user?.id) {
            try {
              const spaceMemberData = await getUserSpaceRole({
                spaceId: pageInfo.spaceId,
                userId: currentUser.user.id
              });
              const spaceMemberRole = spaceMemberData?.data?.role;
              hasSpaceAdminRights = spaceMemberRole === 'admin' || spaceMemberRole === 'owner';
            } catch (e) {
              console.error("Failed to fetch space member role:", e);
            }
          }

          // Если у пользователя есть права owner или admin (в users или spaceMembers), даем доступ
          const finalHasAdminRights = hasOwnerRole || hasAdminRole || hasSpaceAdminRights;
          setHasAdminRights(finalHasAdminRights);

          // Убираем избыточное логирование для оптимизации
        }
      } catch (err) {
        console.error("Failed to check user permissions:", err);
        setUserBlockPermission(null);
        setIsPageCreator(false);
      }
    };

    // Проверяем права при изменении выделения
    const handleSelectionUpdate = () => {
      checkUserPermissions();
    };

    props.editor.on('selectionUpdate', handleSelectionUpdate);

    // Начальная проверка
    checkUserPermissions();

    return () => {
      props.editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [props.editor, currentUser?.user?.id]);

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

        {/* Показываем кнопку поиска для владельцев, создателей или администраторов */}
        {(userBlockPermission === 'owner' || isPageCreator || hasAdminRights) && (
          <Tooltip label="Search Users" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              radius="0"
              aria-label="Search"
              style={{ border: "none" }}
              onClick={() => {
                setSearchModalOpened(true);
              }}
            >
              <IconSearch size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Модальное окно управления правами доступа */}
      {(props.pageId ?? props.editor.storage.pageId) && (
        <SearchMenu
          opened={searchModalOpened}
          onClose={() => setSearchModalOpened(false)}
          pageId={(props.pageId ?? props.editor.storage.pageId) as string}
          blockId={props.blockId}
        />
      )}
    </BubbleMenu>
  );
};
