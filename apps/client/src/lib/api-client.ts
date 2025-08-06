import axios, { AxiosInstance } from "axios";
import APP_ROUTE from "@/lib/app-route.ts";
import { isCloud } from "@/lib/config.ts";

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

// Функции для работы с блоками и правами доступа
export const assignPermissionToBlock = async ({ pageId, blockId, userId, role }: {
  pageId: string;
  blockId: string;
  userId: string;
  role: "read" | "edit" | "owner";
}) => {
  return api.post(`/pages/${pageId}/blocks/${blockId}/permissions`, {
    userId,
    role
  });
};

export const getBlockPermissions = async ({ pageId, blockId }: {
  pageId: string;
  blockId: string;
}) => {
  return api.get(`/pages/${pageId}/blocks/${blockId}/permissions`);
};

export const removeBlockPermission = async ({ pageId, blockId, userId }: {
  pageId: string;
  blockId: string;
  userId: string;
}) => {
  return api.delete(`/pages/${pageId}/blocks/${blockId}/permissions/${userId}`);
};

export const updateBlockPermission = async ({ pageId, blockId, userId, role }: {
  pageId: string;
  blockId: string;
  userId: string;
  role: "read" | "edit" | "owner";
}) => {
  return api.put(`/pages/${pageId}/blocks/${blockId}/permissions/${userId}`, {
    role
  });
};

export const getPageInfo = async ({ pageId }: { pageId: string }) => {
  return api.post('/pages/info', { pageId });
};

export const getUserSpaceRole = async ({ spaceId, userId }: { spaceId: string; userId: string }) => {
  return api.get(`/spaces/${spaceId}/members/${userId}/role`);
};
