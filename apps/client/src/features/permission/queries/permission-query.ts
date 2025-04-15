import {
  keepPreviousData,
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { MemberPermissions, NewPermission } from "../types/permission.types";
import {
  createPermission,
  deletePermission,
  getPermissions,
} from "../services/permission-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

type PermissionType = "page" | "space";
type MutationCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export function usePermissionQuery(
  targetId: string,
  type: PermissionType,
): UseQueryResult<MemberPermissions[], Error> {
  return useQuery({
    queryKey: ["permission", targetId, type],
    queryFn: () => getPermissions(targetId, type),
    enabled: !!targetId,
    placeholderData: keepPreviousData,
  });
}

export function useCreatePermissionMutation(callbacks?: MutationCallbacks) {
  const { t } = useTranslation();

  return useMutation<void, Error, NewPermission>({
    mutationFn: createPermission,
    onSuccess: callbacks?.onSuccess,
    onError: (error) => {
      notifications.show({
        message: t("Failed to create permission"),
        color: "red",
      });
      callbacks?.onError?.(error);
    },
  });
}

export function useDeletePermissionMutation(callbacks?: MutationCallbacks) {
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: deletePermission,
    onSuccess: callbacks?.onSuccess,
    onError: (error) => {
      notifications.show({
        message: t("Failed to delete permission"),
        color: "red",
      });
      callbacks?.onError?.(error);
    },
  });
}
