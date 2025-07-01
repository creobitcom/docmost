export enum BlockCaslAction {
  Manage = 'manage',
  Read = 'read',
  Edit = 'edit',
  Move = 'move',
  Delete = 'delete',
}

export enum BlockCaslSubject {
  Block = 'block',
}

export type IBlockAbility = [BlockCaslAction, BlockCaslSubject];
export type UserBlockRole = 'reader' | 'writer' | 'admin';
export type BlockAbilityAction = 'read' | 'update' | 'delete';
