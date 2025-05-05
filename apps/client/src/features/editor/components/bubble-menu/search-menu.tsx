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
import axios from "axios";
import { Editor } from "@tiptap/react";

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
      console.warn("Block ID not found");
      return;
    }

    const payload = {
      userId: user.id,
      pageId,
      blockId,
      role: "member",
      permission: "read",
    };

    try {
      const response = await axios.post(`${API_URL}/api/pages/blockPermissions`, payload);
      console.log("User permission saved", response.data);

      onSelect({
        id: user.id,
        label: user.name,
        entityType: "user",
        avatarUrl: user.avatarUrl,
      });

      setOpened(false);
    } catch (error) {
      console.error("Error saving permission", error);
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={300}
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <div
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      </Popover.Target>

      <Popover.Dropdown p="xs">
        <TextInput
          placeholder="Поиск пользователя"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mb="sm"
          autoFocus
        />

        {isLoading ? (
          <Loader size="xs" />
        ) : data?.items?.length ? (
          <ScrollArea.Autosize mah={250}>
            {data.items.map((user) => (
              <Group
                key={user.id}
                wrap="nowrap"
                p="xs"
                style={{ cursor: "pointer", borderRadius: 4 }}
                onClick={() => handleSelectUser(user)}
              >
                <Avatar src={user.avatarUrl} size="sm" />
                <div>
                  <Text size="sm" fw={500} lineClamp={1}>
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {user.email}
                  </Text>
                </div>
              </Group>
            ))}
          </ScrollArea.Autosize>
        ) : (
          <Text size="sm" c="dimmed" ta="center">
            Пользователи не найдены
          </Text>
        )}
      </Popover.Dropdown>
    </Popover>
  );
};
