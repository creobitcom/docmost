import { Stack, Group, Text, Checkbox } from "@mantine/core";
import {
  PermissionItem,
  PERMISSION_LIST_PAGE,
  PERMISSION_LIST_SPACE,
} from "../constants/permission-items";
import { MemberPermissions } from "../types/permission.types";

interface PermissionCategoryProps {
  member: MemberPermissions;
  onPermissionChange: (
    checked: boolean,
    member: MemberPermissions,
    permissionItem: PermissionItem,
  ) => void;
  readOnly: boolean;
  type: "page" | "space";
}

export function PermissionCategory({
  member,
  onPermissionChange,
  readOnly,
  type = "page",
}: PermissionCategoryProps) {
  const hasPermission = (permissionItem: PermissionItem) => {
    return member.permissions.some(
      (perm) =>
        perm.action === permissionItem.action &&
        perm.object === permissionItem.object,
    );
  };

  const permissionList =
    type === "page" ? PERMISSION_LIST_PAGE : PERMISSION_LIST_SPACE;

  return (
    <Stack>
      {permissionList.map((permissionItem, index) => (
        <Group key={index}>
          <div>
            <Text size="sm" fw={500}>
              {permissionItem.name}
            </Text>
            <Text size="xs" color="dimmed">
              {permissionItem.description}
            </Text>
          </div>
          <Checkbox
            checked={hasPermission(permissionItem)}
            onChange={(event) =>
              onPermissionChange(
                event.currentTarget.checked,
                member,
                permissionItem,
              )
            }
            disabled={readOnly}
          />
        </Group>
      ))}
    </Stack>
  );
}
