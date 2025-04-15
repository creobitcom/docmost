import { useState, useEffect } from "react";
import {
  Stack,
  Group,
  Text,
  Divider,
  Paper,
  ScrollArea,
  Modal,
  Button,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useCreatePagePermissionMutation,
  useDeletePagePermissionMutation,
  usePagePermissionQuery,
} from "@/features/permission/queries/page-permission-query";
import { MemberPagePermissions } from "@/features/permission/types/permission.types";
import { MultiMemberSelect } from "@/features/space/components/multi-member-select";
import { useDisclosure } from "@mantine/hooks";
import { PermissionItem } from "@/features/permission/constants/permission-items";
import { MemberPermissionCard } from "./member-permission-card";

interface PagePermissionsPanelProps {
  pageId: string;
  readOnly?: boolean;
}

export default function PagePermissionsPanel({
  pageId,
  readOnly = false,
}: PagePermissionsPanelProps) {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = usePagePermissionQuery(pageId);
  const [members, setMembers] = useState<MemberPagePermissions[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [deleteConfirmModal, deleteConfirmModalHandlers] = useDisclosure(false);
  const [memberToDelete, setMemberToDelete] =
    useState<MemberPagePermissions | null>(null);

  const createPermission = useCreatePagePermissionMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const deletePermission = useDeletePagePermissionMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const [addMemberModal, addMemberModalHandlers] = useDisclosure(false);

  useEffect(() => {
    if (data) {
      setMembers(data);
    }
  }, [data]);

  const handlePermissionChange = async (
    checked: boolean,
    member: MemberPagePermissions,
    permissionItem: PermissionItem,
  ) => {
    const targetId = member.userId ?? member.groupId;

    if (!targetId) return;

    if (checked) {
      createPermission.mutate({
        pageId,
        userId: member.type === "user" ? targetId : undefined,
        groupId: member.type === "group" ? targetId : undefined,
        action: permissionItem.action,
        object: permissionItem.object,
      });
    } else {
      const permissionToDelete = member.permissions.find(
        (p) =>
          p.action === permissionItem.action &&
          p.object === permissionItem.object,
      );

      if (permissionToDelete?.id) {
        deletePermission.mutate(permissionToDelete.id);
      }
    }
  };

  const handleDeleteMember = (member: MemberPagePermissions) => {
    setMemberToDelete(member);
    deleteConfirmModalHandlers.open();
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;

    for (const permission of memberToDelete.permissions) {
      if (permission.id) {
        deletePermission.mutate(permission.id);
      }
    }

    setMemberToDelete(null);
    deleteConfirmModalHandlers.close();
  };

  const handleAddMembers = async () => {
    const { userIds, groupIds } = selectedMemberIds.reduce(
      (acc, id) => {
        if (id.startsWith("user-")) {
          acc.userIds.push(id.split("user-")[1]);
        } else if (id.startsWith("group-")) {
          acc.groupIds.push(id.split("group-")[1]);
        }
        return acc;
      },
      { userIds: [], groupIds: [] },
    );

    const basePermission = {
      pageId,
      action: "read",
      object: "page",
    };

    groupIds.forEach((groupId) => {
      createPermission.mutate({
        ...basePermission,
        groupId,
      });
    });

    userIds.forEach((userId) => {
      createPermission.mutate({
        ...basePermission,
        userId,
      });
    });

    addMemberModalHandlers.close();
    setSelectedMemberIds([]);
  };

  if (readOnly) {
    return (
      <Paper p="md" withBorder>
        <Text>
          {t("You do not have permission to view or edit permission settings.")}
        </Text>
      </Paper>
    );
  }

  return (
    <>
      <ScrollArea h={550} offsetScrollbars>
        <Stack>
          <Group>
            <Button onClick={addMemberModalHandlers.open}>
              {t("Add members")}
            </Button>
          </Group>

          {isLoading ? (
            <Text>{t("Loading permissions...")}</Text>
          ) : (
            members?.map((member) => (
              <MemberPermissionCard
                key={member.userId ?? member.groupId}
                member={member}
                onPermissionChange={handlePermissionChange}
                onDelete={handleDeleteMember}
                readOnly={readOnly}
              />
            ))
          )}

          {!isLoading && members?.length === 0 && (
            <Paper p="md" withBorder>
              <Text color="dimmed">{t("No members with permissions yet")}</Text>
            </Paper>
          )}
        </Stack>
      </ScrollArea>

      {/* Add Members Modal */}
      <Modal
        opened={addMemberModal}
        onClose={addMemberModalHandlers.close}
        title={t("Add members")}
      >
        <Divider size="xs" mb="xs" />

        <Stack>
          <MultiMemberSelect
            onChange={setSelectedMemberIds}
            // value={selectedMemberIds}
          />
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={addMemberModalHandlers.close}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleAddMembers}
            disabled={selectedMemberIds.length === 0}
          >
            {t("Add")}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={deleteConfirmModal}
        onClose={deleteConfirmModalHandlers.close}
        title={t("Remove member permissions")}
        size="sm"
      >
        <Text size="sm" mb="lg">
          {t("Are you sure you want to remove all permissions for")}
          <Text component="span" fw={600}>
            {" "}
            {memberToDelete?.name}
          </Text>
          ?
        </Text>

        <Group>
          <Button variant="outline" onClick={deleteConfirmModalHandlers.close}>
            {t("Cancel")}
          </Button>
          <Button color="red" onClick={confirmDeleteMember}>
            {t("Remove")}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
