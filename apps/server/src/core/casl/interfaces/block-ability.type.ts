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

  export type IBlockAbility = [BlockCaslAction, BlockCaslSubject.Block];
  export type UserBlockRole = 'reader' | 'writer' | 'admin';
  export type BlockAbilityAction = 'read' | 'update' | 'delete';

  export interface BlockAbility {
    blockId: string;
    actions: BlockAbilityAction[];
  }