export enum CaslObject {
  Page = 'page',
  Space = 'space',
  Permission = 'permission',
}

export enum CaslAction {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
}

export type IPermissionAbility = [string, string];
