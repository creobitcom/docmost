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

export const updatePageBlocks = async (pageId: string, blocks: IPageBlock[]) => {
  console.log('📤 Sending blocks:', blocks);
  try {
    const response = await axios.post(`/api/pages/blocks/${pageId}`, { blocks });
    return response.data;
  } catch (error) {
    throw new Error('Ошибка при обновлении блоков страницы');
  }
};

export async function getBlockPermissions({ pageId, blockId }: { pageId: string; blockId: string }) {
  const res = await fetch(`/api/pages/blockPermissions/${pageId}/${blockId}`);
  if (!res.ok) throw new Error("Failed to load block permissions");

  const json = await res.json();
  return json.data;
}

const fetchPage = async (pageId: string) => {
  const { data } = await axios.get(`/api/pages/${pageId}`);
  return data;
};

export const usePage = (pageId: string) => {
  return useQuery({
    queryKey: ['page', pageId],
    queryFn: () => fetchPage(pageId),
    enabled: !!pageId,
  });
};

export async function getPagePermissions({ pageId }: { pageId: string }) {
  const response = await fetch(`/api/pages/${pageId}/blockPermissions`);
  if (!response.ok) throw new Error("Failed to fetch page permissions");
  return response.json();
}

export async function getAccessibleBlocks(pageId: string, userId: string) {
  const res = await fetch(`/api/pages/${pageId}/blockPermissions?userId=${userId}`);

  if (!res.ok) {
    throw new Error("Failed to fetch accessible blocks");
  }

  const json = await res.json();
  return json.data;
}
