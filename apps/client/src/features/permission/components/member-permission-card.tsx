import { useState } from "react";
import {
  Group,
  Text,
  Paper,
  ActionIcon,
  Collapse,
  Tooltip,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { MemberPermissions } from "@/features/permission/types/permission.types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { IconGroupCircle } from "@/components/icons/icon-people-circle";
import { formatMemberCount } from "@/lib";
import { PermissionCategory } from "./permission-category";
import { PermissionItem } from "../constants/permission-items";

interface MemberPermissionCardProps {
  member: MemberPermissions;
  onPermissionChange: (
    checked: boolean,
    member: MemberPermissions,
    permissionItem: PermissionItem,
  ) => void;
  readOnly: boolean;
  onDelete: (member: MemberPermissions) => void;
  type: "page" | "space";
}

export function MemberPermissionCard({
  member,
  onPermissionChange,
  readOnly,
  onDelete,
  type,
}: MemberPermissionCardProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  return (
    <Paper p="sm" withBorder>
      <Group mb={opened ? "md" : 0}>
        <Group gap="sm" wrap="nowrap">
          {member.type === "user" && (
            <CustomAvatar
              avatarUrl={member?.userAvatarUrl}
              name={member.name}
            />
          )}

          {member.type === "group" && <IconGroupCircle />}

          <div>
            <Text fz="sm" fw={500} lineClamp={1}>
              {member?.name}
            </Text>
            <Text fz="xs" c="dimmed">
              {member.type === "user" && member?.userEmail}

              {member.type === "group" &&
                `${t("Group")} - ${formatMemberCount(member?.memberCount, t)}`}
            </Text>
          </div>
        </Group>

        <Group>
          <Tooltip label={t("Remove all permissions")}>
            <ActionIcon color="red" onClick={() => onDelete(member)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon onClick={() => setOpened(!opened)}>
            {opened ? (
              <IconChevronUp size={16} />
            ) : (
              <IconChevronDown size={16} />
            )}
          </ActionIcon>
        </Group>
      </Group>

      <Collapse in={opened}>
        <PermissionCategory
          type={type}
          member={member}
          onPermissionChange={onPermissionChange}
          readOnly={readOnly}
        />
      </Collapse>
    </Paper>
  );
}
