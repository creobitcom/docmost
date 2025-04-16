import { PageCaslAction } from "@/features/page/permissions/permissions.type";
import {
  CaslAction,
  CaslObject,
  PageCaslObject,
  SpaceCaslAction,
  SpaceCaslObject,
} from "./casl";

export interface PermissionItem {
  action: PageCaslAction | SpaceCaslAction;
  object: PageCaslObject | SpaceCaslObject;
  name: string;
  description: string;
}

export const PERMISSION_LIST_PAGE: PermissionItem[] = [
  {
    action: PageCaslAction.Read,
    object: PageCaslObject.Content,
    name: "Read",
    description: "Can read content of the page",
  },
  {
    action: PageCaslAction.Edit,
    object: PageCaslObject.Content,
    name: "Edit",
    description: "Can edit content of the page",
  },
  {
    action: PageCaslAction.Delete,
    object: PageCaslObject.Content,
    name: "Delete",
    description: "Can delete the page",
  },
  {
    action: PageCaslAction.Manage,
    object: PageCaslObject.Permission,
    name: "Manage Permissions",
    description: "Can manage permissions",
  },
  {
    action: PageCaslAction.Manage,
    object: PageCaslObject.Page,
    name: "Manage Page",
    description: "Can manage page",
  },
];

export const PERMISSION_LIST_SPACE: PermissionItem[] = [
  {
    action: SpaceCaslAction.View,
    object: SpaceCaslObject.Space,
    name: "View",
    description: "Can view the space",
  },
  {
    action: SpaceCaslAction.Manage,
    object: SpaceCaslObject.Space,
    name: "Manage",
    description: "Can manage the space",
  },
  {
    action: SpaceCaslAction.Delete,
    object: SpaceCaslObject.Space,
    name: "Delete",
    description: "Can delete the space",
  },
  {
    action: SpaceCaslAction.Manage,
    object: SpaceCaslObject.Permission,
    name: "Manage Permissions",
    description: "Can manage permissions",
  },
  {
    action: SpaceCaslAction.Create,
    object: SpaceCaslObject.Page,
    name: "Create Page",
    description: "Can create page",
  },
];
