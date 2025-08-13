import axios, { AxiosInstance } from "axios";
import APP_ROUTE from "@/lib/app-route.ts";
import { isCloud } from "@/lib/config.ts";
import {IPageBlock} from '../../../server/src/database/types/page-block.types'
import { useQuery } from '@tanstack/react-query';

const api: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => {
    // we need the response headers for these endpoints
    const exemptEndpoints = ["/api/pages/export", "/api/spaces/export"];
    if (response.request.responseURL) {
      const path = new URL(response.request.responseURL)?.pathname;
      if (path && exemptEndpoints.includes(path)) {
        return response;
      }
    }

    return response.data;
  },
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401: {
          const url = new URL(error.request.responseURL)?.pathname;
          if (url === "/api/auth/collab-token") return;

          // Handle unauthorized error
          redirectToLogin();
          break;
        }
        case 403:
          // Handle forbidden error
          break;
        case 404:
          // Handle not found error
          if (
            error.response.data.message
              .toLowerCase()
              .includes("workspace not found")
          ) {
            console.log("workspace not found");
            if (
              !isCloud() &&
              window.location.pathname != APP_ROUTE.AUTH.SETUP
            ) {
              window.location.href = APP_ROUTE.AUTH.SETUP;
            }
          }
          break;
        case 500:
          // Handle internal server error
          break;
        default:
          break;
      }
    }
    return Promise.reject(error);
  },
);

function redirectToLogin() {
  const exemptPaths = [
    APP_ROUTE.AUTH.LOGIN,
    APP_ROUTE.AUTH.SIGNUP,
    APP_ROUTE.AUTH.FORGOT_PASSWORD,
    APP_ROUTE.AUTH.PASSWORD_RESET,
    "/invites",
  ];
  if (!exemptPaths.some((path) => window.location.pathname.startsWith(path))) {
    window.location.href = APP_ROUTE.AUTH.LOGIN;
  }
}


export default api;
export const assignPermissionToBlock = async ({
  pageId,
  blockId,
  userId,
  role,
  permission,
}: {
  pageId: string;
  blockId: string;
  userId: string;
  role: string;
  permission?: string;
}) => {
  return api.post("/pages/blockPermissions", {
    pageId,
    blockId,
    userId,
    role,
    permission,
  });
};


export async function getBlockPermissions({ pageId, blockId }: { pageId: string; blockId: string }) {
  const res = await fetch(`/api/pages/blockPermissions/${pageId}/${blockId}`);
  if (!res.ok) throw new Error("Failed to load block permissions");

  const json = await res.json();
  return json.data;
}

export async function getPagePermissions({ pageId }: { pageId: string }) {
  const response = await fetch(`/api/pages/${pageId}/blockPermissions`);
  if (!response.ok) throw new Error("Failed to fetch page permissions");
  return response.json();
}

export async function removeBlockPermission({ pageId, blockId, userId }: { pageId: string; blockId: string; userId: string }) {
  return axios.delete('/api/pages/blockPermissions', {
    data: { pageId, blockId, userId },
  });
}

export async function updateBlockPermission({
  pageId,
  blockId,
  userId,
  permission,
  role,
}: {
  pageId: string;
  blockId: string;
  userId: string;
  permission: 'read' | 'edit' | 'owner';
  role: string;
}) {
  return axios.post('/api/pages/blockPermissions', {
    pageId,
    blockId,
    userId,
    permission,
    role,
  });
}

export async function getPageInfo(pageId: string): Promise<{
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  spaceSlug: string;
}> {
  const { data } = await api.post("/pages/info", {
    pageId,
    includeSpace: true,
  });

  return {
    pageId: data.id,
    pageTitle: data.title,
    pageSlug: data.slugId,
    spaceSlug: data.space?.slug,
  };
}

export const getUserSpaceRole = async ({ spaceId, userId }: { spaceId: string; userId: string }) => {
  return api.get(`/spaces/${spaceId}/members/${userId}/role`);
};