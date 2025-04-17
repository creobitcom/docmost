export enum CaslObject {
  Page = 'page',
  Space = 'space',
  Permission = 'permission',
  Workspace = 'workspace',
  Content = 'content',
}
export enum CaslAction {
  Create = 'create',
  Manage = 'manage',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
  View = 'view',
}

export enum PageCaslObject {
  Page = 'page',
  Permission = 'permission',
  Content = 'content',
}
export enum PageCaslAction {
  Manage = 'manage',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
}

export enum SpaceCaslObject {
  Page = 'page',
  Space = 'space',
  Permission = 'permission',
}
export enum SpaceCaslAction {
  Create = 'create',
  Manage = 'manage',
  View = 'view',
  Edit = 'edit',
  Delete = 'delete',
}

export enum WorkspaceCaslObject {
  Permission = 'permission',
  Workspace = 'workspace',
  Space = 'space',
}
export enum WorkspaceCaslAction {
  Create = 'create',
  Manage = 'manage',
  View = 'view',
  Edit = 'edit',
  Delete = 'delete',
}

export type IPagePermissionAbility =
  | [PageCaslAction, PageCaslObject]
  | [PageCaslAction.Read, PageCaslObject.Content]
  | [PageCaslAction.Edit, PageCaslObject.Content]
  | [PageCaslAction.Delete, PageCaslObject.Page]
  | [PageCaslAction.Manage, PageCaslObject.Permission]
  | [PageCaslAction.Manage, PageCaslObject.Page];

export type ISpacePermissionAbility =
  | [SpaceCaslAction, SpaceCaslObject]
  | [SpaceCaslAction.View, SpaceCaslObject.Space]
  | [SpaceCaslAction.Manage, SpaceCaslObject.Space]
  | [SpaceCaslAction.Delete, SpaceCaslObject.Space]
  | [SpaceCaslAction.Manage, SpaceCaslObject.Permission]
  | [SpaceCaslAction.Create, SpaceCaslObject.Page];

export type IWorkspacePermissionAbility =
  | [WorkspaceCaslAction, WorkspaceCaslObject]
  | [WorkspaceCaslAction.Create, WorkspaceCaslObject.Space]
  | [WorkspaceCaslAction.Manage, WorkspaceCaslObject.Permission];
