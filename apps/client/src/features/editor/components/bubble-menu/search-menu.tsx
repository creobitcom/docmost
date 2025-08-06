import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  Text,
  Avatar,
  Select,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconSearch, IconX, IconUserPlus } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useDebouncedValue } from "@mantine/hooks";
import { useSpaceMembersQuery } from "@/features/space/queries/space-query";
import {
  assignPermissionToBlock,
  getBlockPermissions,
  removeBlockPermission,
  updateBlockPermission,
  getPageInfo,
} from "@/lib/api-client";

interface SearchMenuProps {
  opened: boolean;
  onClose: () => void;
  pageId: string;
}

export function SearchMenu({ opened, onClose, pageId }: SearchMenuProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 500);
  const [isPageCreator, setIsPageCreator] = useState(false);
  const [selectedPermissionsMap, setSelectedPermissionsMap] = useState<
    Record<string, "read" | "edit" | "owner">
  >({});

  const { data, isLoading } = useSpaceMembersQuery(debounced);

  // Получаем ID текущего блока из выделенного текста
  const getBlockId = (): string | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const blockElement = range.commonAncestorContainer.parentElement?.closest('[data-block-id]');
    return blockElement?.getAttribute('data-block-id') || null;
  };

  useEffect(() => {
    const fetchPageInfo = async () => {
      try {
        const pageResponse = await getPageInfo({ pageId });
        setIsPageCreator(pageResponse.data?.creatorId === currentUser?.user?.id);
      } catch (e) {
        console.error("Failed to fetch page info:", e);
      }
    };

    if (opened) {
      fetchPageInfo();
    }
  }, [pageId, currentUser?.user?.id, opened]);

  useEffect(() => {
    const fetchPermissions = async () => {
      const blockId = getBlockId();
      if (!blockId) return;

      try {
        const result = await getBlockPermissions({ pageId, blockId });
        const permissionsMap: Record<string, "read" | "edit" | "owner"> = {};
        result.data?.forEach((permission) => {
          permissionsMap[permission.userId] = permission.role as "read" | "edit" | "owner";
        });
        setSelectedPermissionsMap(permissionsMap);
      } catch (e) {
        console.error("Failed to fetch block permissions:", e);
      }
    };

    if (opened) {
      fetchPermissions();
    }
  }, [pageId, opened]);

  const handleAssignPermission = async (userId: string, role: "read" | "edit" | "owner") => {
    const blockId = getBlockId();
    if (!blockId) return;

    try {
      await assignPermissionToBlock({ pageId, blockId, userId, role });
      setSelectedPermissionsMap(prev => ({ ...prev, [userId]: role }));
    } catch (e) {
      console.error("Failed to assign permission:", e);
    }
  };

  const handleRemovePermission = async (userId: string) => {
    const blockId = getBlockId();
    if (!blockId) return;

    try {
      await removeBlockPermission({ pageId, blockId, userId });
      setSelectedPermissionsMap(prev => {
        const newMap = { ...prev };
        delete newMap[userId];
        return newMap;
      });
    } catch (e) {
      console.error("Failed to remove permission:", e);
    }
  };

  const handleUpdatePermission = async (userId: string, role: "read" | "edit" | "owner") => {
    const blockId = getBlockId();
    if (!blockId) return;

    try {
      await updateBlockPermission({ pageId, blockId, userId, role });
      setSelectedPermissionsMap(prev => ({ ...prev, [userId]: role }));
    } catch (e) {
      console.error("Failed to update permission:", e);
    }
  };

  const filteredMembers = data?.items?.filter(member => member.type === 'user') || [];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Управление правами доступа к блоку"
      size="md"
    >
      <Stack gap="md">
        <TextInput
          placeholder="Поиск пользователей..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<IconSearch size={16} />}
        />

        <Text size="sm" c="dimmed">
          Блок: {getBlockId() || "Не выбран"}
        </Text>

        {filteredMembers.map((member) => {
          const currentPermission = selectedPermissionsMap[member.id];
          const isAssigned = !!currentPermission;
          const isCurrentUser = member.id === currentUser?.user?.id;

          return (
            <Group key={member.id} justify="space-between" align="center">
              <Group gap="sm">
                <Avatar src={member.avatarUrl} size="sm" />
                <div>
                  <Text size="sm" fw={500}>
                    {member.name}
                    {isCurrentUser && (
                      <Text size="xs" c="blue" style={{ marginLeft: '4px' }}>
                        (Вы)
                      </Text>
                    )}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {member.email}
                  </Text>
                </div>
              </Group>

              <Group gap="xs">
                {isAssigned ? (
                  <>
                    <Select
                      size="xs"
                      value={currentPermission}
                      onChange={(value) => 
                        value && handleUpdatePermission(member.id, value as "read" | "edit" | "owner")
                      }
                      data={[
                        { value: "read", label: "Чтение" },
                        { value: "edit", label: "Редактирование" },
                        { value: "owner", label: "Владелец" },
                      ]}
                      w={120}
                      disabled={isCurrentUser} // Запрещаем редактирование собственных прав
                    />
                    <Tooltip label={isCurrentUser ? "Нельзя удалить собственные права" : "Удалить права"}>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemovePermission(member.id)}
                        disabled={isCurrentUser} // Запрещаем удаление собственных прав
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                ) : (
                  <Button
                    size="xs"
                    leftSection={<IconUserPlus size={14} />}
                    onClick={() => handleAssignPermission(member.id, "read")}
                    disabled={isCurrentUser} // Запрещаем добавление собственных прав
                  >
                    Добавить
                  </Button>
                )}
              </Group>
            </Group>
          );
        })}

        {filteredMembers.length === 0 && !isLoading && (
          <Text size="sm" c="dimmed" ta="center">
            Пользователи не найдены
          </Text>
        )}
      </Stack>
    </Modal>
  );
} 