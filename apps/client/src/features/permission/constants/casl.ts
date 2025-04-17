export enum CaslObject {
  Page = "page",
  Space = "space",
  Permission = "permission",
  Workspace = "workspace",
  Content = "content",
}
export enum CaslAction {
  Create = "create",
  Manage = "manage",
  Read = "read",
  Edit = "edit",
  Delete = "delete",
  View = "view",
}

export enum PageCaslObject {
  Page = "page",
  Permission = "permission",
  Content = "content",
}
export enum PageCaslAction {
  Manage = "manage",
  Read = "read",
  Edit = "edit",
  Delete = "delete",
}

export enum SpaceCaslObject {
  Page = "page",
  Space = "space",
  Permission = "permission",
}
export enum SpaceCaslAction {
  Create = "create",
  Manage = "manage",
  View = "view",
  Edit = "edit",
  Delete = "delete",
}

export enum WorkspaceCaslObject {
  Permission = "permission",
  Workspace = "workspace",
  Space = "space",
}
export enum WorkspaceCaslAction {
  Create = "create",
  Manage = "manage",
  View = "view",
  Edit = "edit",
  Delete = "delete",
}
