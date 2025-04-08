import { ISpace } from "@/features/space/types/space.types.ts";
import { SpaceRole } from "@/lib/types";
import {
  PageCaslAction,
  PageCaslSubject,
} from "../permissions/permissions.type";
import { usePageBreadcrumbsQuery } from "../queries/page-query";

export interface IPage {
  id: string;
  slugId: string;
  title: string;
  content: string;
  icon: string;
  coverPhoto: string;
  parentPageId: string;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  isLocked: boolean;
  lastUpdatedById: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  position: string;
  hasChildren: boolean;
  creator: ICreator;
  lastUpdatedBy: ILastUpdatedBy;
  space: Partial<ISpace>;
  membership?: IMembership;
}

interface IMembership {
  userId: string;
  role: SpaceRole;
  permissions?: Permissions;
}
interface Permission {
  action: PageCaslAction;
  subject: PageCaslSubject;
}

type Permissions = Permission[];

export interface PageUserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  type: "user";
}

export interface PageGroupInfo {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
  type: "group";
}

export type IPageMember = { role: string } & (PageUserInfo | PageGroupInfo);

export interface IAddPageMember {
  pageId: string;
  userIds?: string[];
  groupIds?: string[];
}

export interface IRemovePageMember {
  pageId: string;
  userId?: string;
  groupId?: string;
}

export interface IChangePageMemberRole {
  pageId: string;
  userId?: string;
  groupId?: string;
}

interface ICreator {
  id: string;
  name: string;
  avatarUrl: string;
}
interface ILastUpdatedBy {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface IMovePage {
  pageId: string;
  position?: string;
  after?: string;
  before?: string;
  parentPageId?: string;
}

export interface SidebarPagesParams {
  spaceId: string;
  pageId?: string;
  page?: number; // pagination
}

export interface IPageInput {
  pageId: string;
  title: string;
  parentPageId: string;
  icon: string;
  coverPhoto: string;
  position: string;
}

export interface IExportPageParams {
  pageId: string;
  format: ExportFormat;
  includeChildren?: boolean;
}

export enum ExportFormat {
  HTML = "html",
  Markdown = "markdown",
}
