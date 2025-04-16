import { CaslAction, CaslObject } from "./casl";

export interface PermissionItem {
  action: CaslAction;
  object: CaslObject;
  name: string;
  description: string;
}

export const PERMISSION_LIST_PAGE: PermissionItem[] = [
  {
    action: CaslAction.Read,
    object: CaslObject.Page,
    name: "Read",
    description: "Can view the page",
  },
  {
    action: CaslAction.Edit,
    object: CaslObject.Page,
    name: "Write",
    description: "Can edit the page",
  },
  {
    action: CaslAction.Delete,
    object: CaslObject.Page,
    name: "Delete",
    description: "Can delete the page",
  },
  {
    action: CaslAction.Manage,
    object: CaslObject.Members,
    name: "Manage Members",
    description: "Can manage members",
  },
];

export const PERMISSION_LIST_SPACE: PermissionItem[] = [
  {
    action: CaslAction.Read,
    object: CaslObject.Space,
    name: "Read",
    description: "Can view the space",
  },
  {
    action: CaslAction.Edit,
    object: CaslObject.Space,
    name: "Write",
    description: "Can edit the space",
  },
  {
    action: CaslAction.Delete,
    object: CaslObject.Space,
    name: "Delete",
    description: "Can delete the space",
  },
  {
    action: CaslAction.Manage,
    object: CaslObject.Members,
    name: "Manage Members",
    description: "Can manage members",
  },
];
