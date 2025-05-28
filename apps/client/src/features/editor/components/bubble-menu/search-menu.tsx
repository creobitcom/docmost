import React, { useEffect, useState, forwardRef } from "react";
import {
  Box,
  TextInput,
  Text,
  Loader,
  Avatar,
  Group,
  ScrollArea,
  Modal,
  Button,
  Select,
  Divider,
  Stack,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { Editor } from "@tiptap/react";
import { notifications } from "@mantine/notifications";
import { assignPermissionToBlock } from "@/lib/api-client";
import { getBlockPermissions } from "@/lib/api-client";
import { Tooltip, ActionIcon } from '@mantine/core';
import { IconLink } from '@tabler/icons-react';

interface ItemProps extends React.ComponentPropsWithoutRef<"div"> {
  label: string;
  value: string;
}

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(({ label, value, ...others }, ref) => (
  <div
    ref={ref}
    {...others}
    style={{
      padding: 8,
      color: value === "delete" ? "#fa5252" : undefined,
    }}
  >
    <Text size="sm">{label}</Text>
  </div>
));
SelectItem.displayName = "SelectItem";

interface SearchMenuProps {
  open: boolean;
  onClose: () => void;
  onSelect: (user: any) => void;
  editor: Editor;
  pageId: string;
}

interface BlockPermission {
  userId: string;
  name: string;
  permission: "read" | "edit" | "owner";
  avatarUrl?: string;
}

export function CopyBlockLinkButton({ pageId, blockId }: { pageId: string; blockId: string }) {
  const handleCopy = async () => {
    const url = `${window.location.origin}/pages/${pageId}#block-${blockId}`;

    try {
      await navigator.clipboard.writeText(url);
      notifications.show({ message: 'Link copied to clipboard', color: 'green' });
    } catch (err) {
      notifications.show({ message: 'Failed to copy link', color: 'red' });
    }
  };

  return (
    <Tooltip label="Copy block link">
      <Button
        variant="light"
        leftSection={<IconLink size={16} />}
        onClick={handleCopy}
        style={{ flex: 1 }}
      >
        Copy link
      </Button>
    </Tooltip>
  );
}


const permissionOptions = [
  { label: "Owner", value: "owner" },
  { label: "Edit", value: "edit" },
  { label: "Read", value: "read" },
  { label: "Удалить доступ", value: "delete" },
];

export const SearchMenu = ({ open, onClose, onSelect, editor, pageId }: SearchMenuProps) => {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const [blockPermissions, setBlockPermissions] = useState<BlockPermission[]>([]);

  const [selectedPermissionsMap, setSelectedPermissionsMap] = useState<
    Record<string, "read" | "edit" | "owner">
  >({});

  const { data, isLoading } = useWorkspaceMembersQuery({
    page: 1,
    limit: 5,
    query: debounced,
  });

  useEffect(() => {
    const fetchPermissions = async () => {
      const blockId = getBlockId();
      if (!blockId) return;

      try {
        const result = await getBlockPermissions({ pageId, blockId });
          setBlockPermissions(
            result.map((item) => ({
              userId: item.id,
              name: item.name,
              avatarUrl: item.avatarUrl,
              permission: item.permission,
            }))
          );
      } catch (err) {
        notifications.show({ message: "Failed to load permissions", color: "red" });
      }
    };

    if (open) {
      fetchPermissions();
    } else {
      setSearch("");
      setBlockPermissions([]);
    }
  }, [open]);
  const getBlockId = () => {
    const { state } = editor;
    const { selection } = state;
    const fromPos = selection.from;
    let foundNode = null;

    state.doc.nodesBetween(fromPos, fromPos, (node) => {
      if (node.attrs?.blockId) {
        foundNode = node;
        return false;
      }
      return true;
    });

    return foundNode?.attrs?.blockId;
  };
  const blockId = getBlockId();

  const handleSelectUserWithPermission = async (user: any) => {
    const blockId = getBlockId();

    if (!blockId || !pageId) {
      notifications.show({
        message: "Block or page ID not found",
        color: "red",
      });
      return;
    }

    const permission = selectedPermissionsMap[user.id] || "read";

    try {
      await assignPermissionToBlock({
        userId: user.id,
        pageId,
        blockId,
        role: user.role,
        permission,
      });

      notifications.show({ message: "User permission saved", color: "green" });

      onSelect({
        id: user.id,
        label: user.name,
        entityType: "user",
        avatarUrl: user.avatarUrl,
      });

      setBlockPermissions((prev) => {
        const exists = prev.find((p) => p.userId === user.id);
        if (exists) {
          return prev.map((p) =>
            p.userId === user.id ? { ...p, permission, name: user.name, avatarUrl: user.avatarUrl } : p
          );
        }
        return [...prev, { userId: user.id, name: user.name, permission, avatarUrl: user.avatarUrl }];
      });

      setSelectedPermissionsMap((prev) => ({
        ...prev,
        [user.id]: permission,
      }));
    } catch (error) {
      notifications.show({
        message: "Failed to save user permission",
        color: "red",
      });
    }
  };

  const handleChangePermission = (userId: string, permission: "read" | "edit" | "owner") => {
    setSelectedPermissionsMap((prev) => ({
      ...prev,
      [userId]: permission,
    }));

    setBlockPermissions((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, permission } : p))
    );

    notifications.show({ message: `Permission changed to ${permission}`, color: "green" });
  };

  const handleRemovePermission = (userId: string) => {
    setBlockPermissions((prev) => prev.filter((p) => p.userId !== userId));
    setSelectedPermissionsMap((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    notifications.show({ message: "Access removed", color: "blue" });
  };

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title="Assign permission"
      size="lg"
      yOffset="10vh"
      zIndex={10000}
    >
      {blockPermissions.length > 0 && (
        <>
          <Text size="sm" fw={500} mt="md" mb="xs">
            Shared with
          </Text>
          <ScrollArea.Autosize mah={200}>
            <Stack gap="xs">
              {blockPermissions.map((user) => (
                <Group
                  key={user.userId}
                  justify="space-between"
                  p="xs"
                  style={{ borderRadius: 8, border: "1px solid #eee" }}
                >
                  <Group>
                    <Avatar src={user.avatarUrl} size="sm" />
                    <Box>
                      <Text size="sm">{user.name}</Text>
                    </Box>
                  </Group>
                  <Select
                    searchable={false}
                    value={user.permission}
                    onChange={(value) => {
                      if (value === "delete") {
                        handleRemovePermission(user.userId);
                      } else if (value === "read" || value === "edit" || value === "owner") {
                        handleChangePermission(user.userId, value);
                      }
                    }}
                    data={permissionOptions}
                    w={130}
                    renderOption={({ option }) => (
                      <div
                        style={{
                          padding: 8,
                          color: option.value === "delete" ? "#fa5252" : undefined,
                        }}
                      >
                        {option.label}
                      </div>
                    )}
                    styles={{
                      dropdown: {
                        zIndex: 10001,
                      },
                    }}
                  />
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
          <Divider my="sm" />
        </>
      )}

      <TextInput
        placeholder="Search user..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="sm"
      />

      {isLoading ? (
        <Loader size="sm" />
      ) : (
        <ScrollArea.Autosize mah={200}>
          {data?.items.map((user) => {
            const permission = selectedPermissionsMap[user.id] || "read";

            return (
              <Group
                key={user.id}
                p="xs"
                style={{ cursor: "pointer", borderRadius: 8, justifyContent: "space-between" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f3f5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {/* user card */}
                <Group
                  style={{ flexGrow: 1 }}
                  onClick={() => handleSelectUserWithPermission(user)}
                >
                  <Avatar src={user.avatarUrl} size="sm" />
                  <Box>
                    <Text size="sm">{user.name}</Text>
                  </Box>
                </Group>

                {/* permission selector */}
                <Select
                  value={permission}
                  onChange={(value) => {
                    if (value === "delete") {
                      // Если пользователь в списке прав — удаляем
                      if (blockPermissions.find((p) => p.userId === user.id)) {
                        handleRemovePermission(user.id);
                      }
                    } else if (value === "read" || value === "edit" || value === "owner") {
                      setSelectedPermissionsMap((prev) => ({
                        ...prev,
                        [user.id]: value,
                      }));
                    }
                  }}
                  data={permissionOptions}
                  w={120}
                  styles={{
                    dropdown: {
                      zIndex: 10001,
                    },
                  }}
                />
              </Group>
            );
          })}
        </ScrollArea.Autosize>
      )}
        <Group grow mt="md">
          <Button
            variant="default"
            style={{ flex: 1 }}
            onClick={onClose}>
            Close
          </Button>
          <CopyBlockLinkButton pageId={pageId} blockId={blockId!} />
        </Group>
    </Modal>
  );
};
