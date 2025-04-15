import {
  keepPreviousData,
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  MemberPagePermissions,
  NewPagePermission,
} from "../types/permission.types";
import {
  createPagePermission,
  deletePagePermission,
  getPagePermissions,
} from "../services/permission-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function usePagePermissionQuery(
  pageId: string,
): UseQueryResult<MemberPagePermissions[], Error> {
  return useQuery({
    queryKey: ["permission", pageId],
    queryFn: () => getPagePermissions(pageId),
    enabled: !!pageId,
    placeholderData: keepPreviousData,
  });
}

export function useCreatePagePermissionMutation({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  return useMutation<void, Error, NewPagePermission>({
    mutationFn: (data) => createPagePermission(data),
    onSuccess: onSuccess,
    onError: (error) => {
      notifications.show({
        message: t("Failed to create permission"),
        color: "red",
      });
    },
  });
}

export function useDeletePagePermissionMutation({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  return useMutation<void, Error, string>({
    mutationFn: (data) => deletePagePermission(data),
    onSuccess: onSuccess,
    onError: (error) => {
      notifications.show({
        message: t("Failed to delete permission"),
        color: "red",
      });
    },
  });
}
