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
import { IconSearch, IconLink } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { Editor } from "@tiptap/react";
import { notifications } from "@mantine/notifications";
import { assignPermissionToBlock } from "@/lib/api-client";
import { getBlockPermissions, removeBlockPermission, updateBlockPermission } from "@/lib/api-client";
import { Tooltip, ActionIcon } from '@mantine/core';
import { getPageInfo, getUserSpaceRole } from "@/lib/api-client";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";

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
  opened: boolean;
  onClose: () => void;
  pageId: string;
}

interface BlockPermission {
  userId: string;
  name: string;
  permission: "read" | "edit" | "owner";
  avatarUrl?: string;
}

interface PagePermission {
  userId: string;
  name: string;
  permission: "read" | "edit" | "owner";
  avatarUrl?: string;
}

export function CopyBlockLinkButton({
  spaceSlug,
  pageSlug,
  pageTitle,
  blockId,
}: {
  spaceSlug: string;
  pageSlug: string;
  pageTitle: string;
  blockId: string;
}) {
  const handleCopy = async () => {
    const encodedTitle = encodeURIComponent(pageTitle ?? "");
    const url = `${window.location.origin}/s/${spaceSlug}/p/${encodedTitle}-${pageSlug}#${blockId}`;

    try {
      await navigator.clipboard.writeText(url);
      notifications.show({ message: "Link copied to clipboard", color: "green" });
    } catch (err) {
      notifications.show({ message: "Failed to copy link", color: "red" });
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

export function SearchMenu({ opened, onClose, pageId, blockId: externalBlockId }: SearchMenuProps & { blockId?: string | null }) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const [blockPermissions, setBlockPermissions] = useState<BlockPermission[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [pagePermissions, setPagePermissions] = useState<PagePermission[] | null>(null);
  const [loadingPagePerms, setLoadingPagePerms] = useState(false);
  const [pageSlug, setPageSlug] = useState<string | null>(null);
  const [spaceSlug, setSpaceSlug] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [currentUser] = useAtom(currentUserAtom);
  const [userBlockPermission, setUserBlockPermission] = useState<string | null>(null);
  const [isPageCreator, setIsPageCreator] = useState(false);
  const [hasAdminRights, setHasAdminRights] = useState(false);

  useEffect(() => {
    const fetchPageInfo = async () => {
      // Проверяем, что pageId не пустой
      if (!pageId || pageId.trim() === '') {
        console.log('[SearchMenu] Empty pageId, skipping fetch');
        return;
      }

      try {
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

          // Используем creatorId напрямую для определения создателя
          const creatorId = pageInfo?.creatorId || pageInfo?.creatorId || pageInfo?.creator?.id;
          setIsPageCreator(creatorId === currentUser?.user?.id);

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

          console.log('[SearchMenu] Admin rights check:', {
            userId: currentUser?.user?.id,
            userRole,
            hasOwnerRole,
            hasAdminRole,
            hasSpaceAdminRights,
            finalHasAdminRights,
            isPageCreator: creatorId === currentUser?.user?.id
          });

          // Получаем информацию о странице для копирования ссылки
          setSpaceSlug(pageInfo?.spaceSlug);
          setPageSlug(pageInfo?.pageSlug);
          setPageTitle(pageInfo?.pageTitle);
        }
      } catch (e) {
        console.error("Failed to fetch page info:", e);
      }
    };

    fetchPageInfo();
  }, [pageId, currentUser?.user?.id, currentUser?.user?.role]);

  const [selectedPermissionsMap, setSelectedPermissionsMap] = useState<
    Record<string, "read" | "edit" | "owner">
  >({});

  const { data, isLoading } = useWorkspaceMembersQuery({
    page: 1,
    limit: 5,
    query: debounced,
  });

    // Получаем ID текущего блока: сначала из props, иначе из выделения
  const getBlockId = (): string | null => {
    console.log('[SearchMenu] getBlockId called, externalBlockId:', externalBlockId);

    if (externalBlockId) {
      console.log('[SearchMenu] Using externalBlockId:', externalBlockId);
      return externalBlockId;
    }

    // Fallback: пытаемся найти блок в DOM
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.log('[SearchMenu] No selection found');
      return null;
    }

    const range = selection.getRangeAt(0);
    const blockElement = range.commonAncestorContainer instanceof Element
      ? (range.commonAncestorContainer as Element).closest('[data-block-id]')
      : (range.commonAncestorContainer.parentElement?.closest('[data-block-id]'));

    const foundBlockId = blockElement?.getAttribute('data-block-id') || null;
    console.log('[SearchMenu] Found blockId from DOM:', foundBlockId);
    return foundBlockId;
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      const blockId = getBlockId();
      if (!blockId || !pageId || pageId.trim() === '') {
        console.log('[SearchMenu] Missing blockId or pageId for permissions fetch:', { blockId, pageId });
        return;
      }

      try {
        const result = await getBlockPermissions({ pageId, blockId });
        setBlockPermissions(
          result.data?.map((item) => ({
            userId: item.userId,
            name: item.name,
            avatarUrl: item.avatarUrl,
            permission: item.role,
          })) || []
        );

        // Проверяем права текущего пользователя на этот блок
        const currentUserPermission = result.data?.find(item => item.userId === currentUser?.user?.id);
        setUserBlockPermission(currentUserPermission?.role || null);
      } catch (err) {
        notifications.show({ message: "Failed to load permissions", color: "red" });
      }
    };

    if (opened) {
      fetchPermissions();
    } else {
      setSearch("");
      setBlockPermissions([]);
      setUserBlockPermission(null);
    }
  }, [opened, currentUser?.user?.id, pageId]);

  const blockId = getBlockId();

  const handleSelectUserWithPermission = async (user: any) => {
    console.log('[SearchMenu] handleSelectUserWithPermission called with:', {
      user,
      blockId,
      pageId,
      externalBlockId
    });

    if (!blockId || !pageId) {
      console.error('[SearchMenu] Missing required data:', { blockId, pageId, externalBlockId });
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
        role: permission,
        permission,
      });

      notifications.show({ message: "User permission saved", color: "green" });

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

  const handleChangePermission = async (
    userId: string,
    permission: "read" | "edit" | "owner"
  ) => {
    if (!blockId) return;

    const user = data?.items.find((u) => u.id === userId);

    if (!user) {
      notifications.show({
        message: "User not found in workspace",
        color: "red",
      });
      return;
    }

    try {
      await updateBlockPermission({
        userId,
        pageId,
        blockId,
        permission,
        role: String(permission),
      });

      setSelectedPermissionsMap((prev) => ({
        ...prev,
        [userId]: permission,
      }));

      setBlockPermissions((prev) =>
        prev.map((p) =>
          p.userId === userId
            ? { ...p, permission }
            : p
        )
      );

      notifications.show({
        message: `Permission changed to ${permission}`,
        color: "green",
      });
    } catch (e) {
      notifications.show({
        message: "Failed to update permission",
        color: "red",
      });
    }
  };

  const handleRemovePermission = async (userId: string) => {
    if (!blockId) return;

    try {
      await removeBlockPermission({
        pageId,
        blockId,
        userId,
      });

      setBlockPermissions((prev) => prev.filter((p) => p.userId !== userId));
      setSelectedPermissionsMap((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });

      notifications.show({ message: "Access removed", color: "blue" });
    } catch (e) {
      notifications.show({ message: "Failed to remove permission", color: "red" });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Assign permission"
      size="lg"
      yOffset="10vh"
      zIndex={10000}
    >
      {/* Проверка прав пользователя */}
      {userBlockPermission !== 'owner' && !isPageCreator && !hasAdminRights && (
        <Stack gap="md" align="center" py="xl">
          <Text size="lg" fw={500} color="red">
            Недостаточно прав
          </Text>
          <Text size="sm" color="dimmed" ta="center">
            Для управления правами доступа к блоку требуются права владельца (owner), статус создателя страницы или права администратора.
          </Text>
          <Button onClick={onClose} variant="default">
            Закрыть
          </Button>
        </Stack>
      )}

      {/* Основной контент модалки - показывается для владельцев, создателей или администраторов */}
      {(() => {
        const shouldShowContent = userBlockPermission === 'owner' || isPageCreator || hasAdminRights;
        console.log('[SearchMenu] Content visibility check:', {
          userBlockPermission,
          isPageCreator,
          hasAdminRights,
          shouldShowContent
        });
        return shouldShowContent;
      })() && (
        <>
          {/* --- Новый блок: права доступа на страницу --- */}
          {pagePermissions && (
            <>
              <Divider my="md" />
              <Text size="sm" fw={500} mb="xs">
                Page Permissions
              </Text>
              {loadingPagePerms ? (
                <Loader size="sm" />
              ) : pagePermissions.length === 0 ? (
                <Text size="xs" color="dimmed">
                  No permissions found for this page.
                </Text>
              ) : (
                <Stack gap="xs" maw={400}>
                  {pagePermissions.map((perm) => (
                    <Group key={perm.userId} gap="sm" justify="apart" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <Avatar src={perm.avatarUrl} size="sm" />
                        <Text size="sm">{perm.name}</Text>
                      </Group>
                      <Text size="sm" color="dimmed" tt="capitalize" fw={600}>
                        {perm.permission}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </>
          )}
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
            <CopyBlockLinkButton
              spaceSlug={spaceSlug}
              pageSlug={pageSlug}
              pageTitle={pageTitle}
              blockId={blockId}
            />
          </Group>
        </>
      )}
    </Modal>
  );
}