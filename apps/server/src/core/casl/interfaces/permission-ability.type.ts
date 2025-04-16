export enum CaslObject {
  Page = 'page',
  Space = 'space',
  Permission = 'permission',
  Members = 'members',
  Settings = 'settings',
}

export enum CaslAction {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
}

export type IPermissionAbility = [string, string];
