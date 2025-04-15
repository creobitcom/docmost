export interface PermissionItem {
  action: string;
  object: string;
  name: string;
  description: string;
}

export const PERMISSION_LIST: PermissionItem[] = [
  {
    action: "read",
    object: "page",
    name: "Read",
    description: "Can view the page",
  },
  {
    action: "edit",
    object: "page",
    name: "Write",
    description: "Can edit the page",
  },
  {
    action: "delete",
    object: "page",
    name: "Delete",
    description: "Can delete the page",
  },
  {
    action: "manage",
    object: "members",
    name: "Manage Members",
    description: "Can manage members",
  },
];
