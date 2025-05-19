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
  Select,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { Editor } from "@tiptap/react";
import { notifications } from "@mantine/notifications";
import { assignPermissionToBlock } from "@/lib/api-client";

interface SearchMenuProps {
  onSelect: (user: any) => void;
  editor: Editor;
  pageId: string;
}

export const SearchMenu = ({ onSelect, editor, pageId }: SearchMenuProps) => {
  const [opened, setOpened] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const [selectedPermission, setSelectedPermission] = useState<"read" | "edit" | "owner">("read");

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
        message: "Failed to add user: no block ID found",
        color: "red",
      });
      return;
    }

    if (!pageId) {
      notifications.show({
        message: "Failed to add user: no page ID",
        color: "red",
      });
      return;
    }

    try {
      await assignPermissionToBlock({
        userId: user.id,
        pageId,
        blockId,
        role: user.role,
        permission: selectedPermission,
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

  return (
    <Popover opened={opened} onChange={setOpened} width={300} trapFocus>
      <Popover.Target>
        <TextInput
          placeholder="Search user..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </Popover.Target>

      <Popover.Dropdown>
        <Select
          label="Permission"
          value={selectedPermission}
          onChange={(value) => {
            if (value) setSelectedPermission(value as any);
          }}
          data={[
            { label: "Read", value: "read" },
            { label: "Edit", value: "edit" },
            { label: "Owner", value: "owner" },
          ]}
          mb="xs"
        />

        {isLoading ? (
          <Loader size="sm" />
        ) : (
          <ScrollArea.Autosize mah={200} offsetScrollbars>
            {data?.items.map((user) => (
              <Box
                key={user.id}
                p="xs"
                style={{ cursor: "pointer" }}
                onClick={() => handleSelectUser(user)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f3f5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Group>
                  <Avatar src={user.avatarUrl} size="sm" />
                  <Text size="sm">{user.name}</Text>
                </Group>
              </Box>
            ))}
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  );
};
