export type Permission = {
  id: string;
  action: string;
  object: string;
  userId?: string;
  groupId?: string;
  pageId?: string;
  spaceId?: string;
};

export type MemberPagePermissions = {
  type: "user" | "group";
  name: string;
  userId?: string;
  userAvatarUrl?: string;
  userEmail?: string;
  groupId?: string;
  memberCount?: number;
  permissions: Permission[];
};

export type NewPagePermission = {
  userId?: string;
  groupId?: string;
  action: string;
  object: string;
  pageId: string;
};
