import React, { useEffect, useState } from "react";
import {
  Box,
  TextInput,
  Text,
  Loader,
  Avatar,
  Group,
  ScrollArea,
  Popover,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { Editor } from "@tiptap/react";
import { createBlockPermission } from "@/features/page/services/page-service";
import { notifications } from "@mantine/notifications";
import { UserRole } from "@/lib/types";
import { assignPermissionToBlock } from "@/lib/api-client";

const API_URL = "http://127.0.0.1:3000";

interface SearchMenuProps {
  onSelect: (user: any) => void;
  editor: Editor;
  pageId: string;
}

export const SearchMenu = ({ onSelect, editor, pageId }: SearchMenuProps) => {
  const [opened, setOpened] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);

  const { data, isLoading } = useWorkspaceMembersQuery({
    page: 1,
    limit: 5,
    query: debounced,
  });

  useEffect(() => {
    if (!opened) setSearch("");
  }, [opened]);

  const getBlockId = () => {
    const { state } = editor;
    const { selection } = state;
    const fromPos = selection.from;
    let foundNode = null;

    state.doc.nodesBetween(fromPos, fromPos, (node) => {
      if (node.attrs?.id) {
        foundNode = node;
        return false;
      }
      return true;
    });

    return foundNode?.attrs?.id;
  };

  const handleSelectUser = async (user: any) => {
    const blockId = getBlockId();

    if (!blockId) {
      notifications.show({
        message: "Failed to add user",
        color: "red",
      });
      return;
    }

    try {
      await assignPermissionToBlock({
        userId: user.id,
        pageId: pageId,
        blockId: blockId,
        role: 'member',
        permission: "read",
      });

      notifications.show({
        message: "User permission saved",
        color: "green",
      });

      onSelect({
        id: user.id,
        label: user.name,
        entityType: "user",
        avatarUrl: user.avatarUrl,
      });

      setOpened(false);
    } catch (error) {
      notifications.show({
        message: "Failed to save user permission",
        color: "red",
      });
    }
  };
}
