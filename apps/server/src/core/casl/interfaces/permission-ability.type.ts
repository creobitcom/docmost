export enum CaslSubject {
  Page = 'page',
  Space = 'space',
  Workspace = 'workspace',
  Permission = 'permission',
}

export enum CaslAction {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export enum PageCaslAction {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Delete = 'delete',
}

export enum SpaceCaslAction {
  Manage = 'manage',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export enum WorkspaceCaslAction {
  Manage = 'manage',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type IPermissionAbility = [string, string];
