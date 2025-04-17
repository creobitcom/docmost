import api from "@/lib/api-client";
import { MemberPermissions, NewPermission } from "../types/permission.types";

type PermissionTargetType = "page" | "space";

export async function getPermissions(
  targetId: string,
  type: PermissionTargetType,
): Promise<MemberPermissions[]> {
  const res = await api.get("/permission", {
    params: { targetId: targetId, type: type },
  });
  return res.data;
}

export async function createPermission(
  newPermission: NewPermission,
): Promise<void> {
  await api.post("/permission", { ...newPermission });
}

export async function deletePermission(permissionsId: string): Promise<void> {
  await api.delete("/permission", { data: { id: permissionsId } });
}
