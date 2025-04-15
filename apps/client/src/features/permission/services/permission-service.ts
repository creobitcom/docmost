import api from "@/lib/api-client";
import {
  MemberPagePermissions,
  NewPagePermission,
} from "../types/permission.types";
import { QueryParams } from "@/lib/types";

export async function getPagePermissions(
  pageId: string,
): Promise<MemberPagePermissions[]> {
  const res = await api.post("/permission/page", { pageId: pageId });
  return res.data;
}

export async function createPagePermission(
  newPagePermission: NewPagePermission,
): Promise<void> {
  await api.post("/permission/create", { ...newPagePermission });
}

export async function deletePagePermission(
  permissionsId: string,
): Promise<void> {
  await api.post("/permission/delete", { id: permissionsId });
}
