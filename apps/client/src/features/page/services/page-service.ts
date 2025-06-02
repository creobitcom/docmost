import api from "@/lib/api-client";
import {
  IExportPageParams,
  IMovePage,
  IMovePageToSpace,
  IPage,
  IPageInput,
  SidebarPagesParams,
  IAddPageMember,
  IPageMember,
  IRemovePageMember,
  IChangePageMemberRole,
  ICreateSynchronizedPage,
  PagesInSpaceParams,
} from "@/features/page/types/page.types";
import { IAttachment, IPagination, QueryParams } from "@/lib/types.ts";
import { saveAs } from "file-saver";

export async function createPage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>("/pages/create", data);
  return req.data;
}

export async function getPageById(
  pageInput: Partial<IPageInput>,
): Promise<IPage & { originPageId?: string; isSyncedPage?: boolean }> {
  const req = await api.post<IPage>("/pages/info", pageInput);
  return req.data;
}

export async function updatePage(data: Partial<IPageInput>): Promise<IPage> {
  const req = await api.post<IPage>("/pages/update", data);
  return req.data;
}

export async function deletePage(pageId: string): Promise<void> {
  await api.post("/pages/delete", { pageId });
}

export async function movePage(data: IMovePage): Promise<void> {
  await api.post<void>("/pages/move", data);
}

export async function movePageToSpace(data: IMovePageToSpace): Promise<void> {
  await api.post<void>("/pages/move-to-space", data);
}

export async function createSynchronizedPage(
  data: ICreateSynchronizedPage,
): Promise<IPage> {
  const req = await api.post<IPage>("/pages/sync-page", data);
  return req.data;
}

export async function getSidebarPages(
  params: SidebarPagesParams,
): Promise<IPagination<IPage>> {
  const req = await api.post("/pages/sidebar-pages", params);
  return req.data;
}

export async function getPagesInSpace(
  params: PagesInSpaceParams,
): Promise<IPagination<IPage>> {
  const req = await api.get("/pages", { params: params });
  return req.data;
}

export async function getPageBreadcrumbs(
  pageId: string,
): Promise<Partial<IPage[]>> {
  const req = await api.post("/pages/breadcrumbs", { pageId });
  return req.data;
}

export async function getRecentChanges(
  spaceId?: string,
): Promise<IPagination<IPage>> {
  const req = await api.post("/pages/recent", { spaceId });
  return req.data;
}

export async function exportPage(data: IExportPageParams): Promise<void> {
  const req = await api.post("/pages/export", data, {
    responseType: "blob",
  });

  const fileName = req?.headers["content-disposition"]
    .split("filename=")[1]
    .replace(/"/g, "");

  saveAs(req.data, decodeURIComponent(fileName));
}

export async function importPage(file: File, spaceId: string) {
  const formData = new FormData();
  formData.append("spaceId", spaceId);
  formData.append("file", file);

  const req = await api.post<IPage>("/pages/import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return req.data;
}

export async function uploadFile(
  file: File,
  pageId: string,
  attachmentId?: string,
): Promise<IAttachment> {
  const formData = new FormData();
  if (attachmentId) {
    formData.append("attachmentId", attachmentId);
  }
  formData.append("pageId", pageId);
  formData.append("file", file);

  const req = await api.post<IAttachment>("/files/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return req as unknown as IAttachment;
}

export async function addPageMember(data: IAddPageMember): Promise<void> {
  await api.post("/pages/members/add", data);
}

export async function getPageMembers(
  pageId: string,
  params?: QueryParams,
): Promise<IPagination<IPageMember>> {
  const req = await api.post<any>("/pages/members", { pageId, ...params });
  return req.data;
}

export async function removePageMember(data: IRemovePageMember): Promise<void> {
  await api.post("/pages/members/remove", data);
}

export async function changeMemberRole(
  data: IChangePageMemberRole,
): Promise<void> {
  await api.post("/pages/members/change-role", data);
}

export async function getMyPages(pageId?: string): Promise<IPagination<IPage>> {
  const req = await api.get("/pages/my-pages", { params: { pageId } });
  return req.data;
}

export async function updateMyPageColor(
  pageId: string,
  color: string,
): Promise<void> {
  const req = await api.post("/pages/my-pages/color", {
    pageId,
    color,
  });
  return req.data;
}

export async function copyPage(
  originPageId: string,
  spaceId: string,
  parentPageId?: string | null,
): Promise<IPage> {
  const req = await api.post("/pages/copy", {
    originPageId,
    spaceId,
    parentPageId,
  });
  return req.data;
}
