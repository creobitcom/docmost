import { NodeApi, TreeApi } from "react-arborist";
import { useAtom } from "jotai";
import { useUpdateMyPageColorMutation } from "@/features/page/queries/page-query.ts";
import { useState } from "react";
import {
  ActionIcon,
  Button,
  ColorPicker,
  Group,
  Menu,
  Modal,
  rem,
  Stack,
} from "@mantine/core";
import {
  IconColorPicker,
  IconDots,
  IconFileExport,
  IconFileSymlink,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import PageShareModal from "@/features/page/components/share-modal";
import {
  pageColorAtom,
  updatePageColorAtom,
} from "@/features/page/tree/atoms/tree-color-atom.ts";
import CreateSyncPageModal from "@/features/page/components/create-sync-page-modal";

interface NodeMenuProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
  isPersonalSpace: boolean;
}

export function MyPageNodeMenu({
  node,
  treeApi,
  isPersonalSpace,
}: NodeMenuProps) {
  const { t } = useTranslation();
  const { openDeleteModal } = useDeletePageModal();
  const updateMyPageColorMutation = useUpdateMyPageColorMutation();

  const [pageColors] = useAtom(pageColorAtom);
  const [, setPageColor] = useAtom(updatePageColorAtom);

  const [color, setColor] = useState(pageColors[node.data.id]);

  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [shareOpened, { open: openShareModal, close: closeShareModal }] =
    useDisclosure(false);
  const [
    colorPickerOpened,
    { open: openColorPicker, close: closeColorPicker },
  ] = useDisclosure(false);
  const [
    createSyncedPageModelOpened,
    { open: openCreateSyncedPageModal, close: closeCreateSyncedPageModal },
  ] = useDisclosure(false);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
  };

  const applyNewColor = async () => {
    try {
      await updateMyPageColorMutation.mutateAsync({
        pageId: node.data.id,
        color: color,
      });

      setPageColor({ pageId: node.data.id, color });

      if (node.data.parentPageId !== null) {
        setPageColor({ pageId: node.data.parentPageId, color });
      }

      notifications.show({ message: t("Color updated") });
    } catch {
      notifications.show({
        message: t("Failed to update color"),
        color: "red",
      });
    }

    closeColorPicker();
  };

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <ActionIcon
            variant="transparent"
            c="gray"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <IconDots style={{ width: rem(20), height: rem(20) }} stroke={2} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconColorPicker size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openColorPicker();
            }}
          >
            {t("Change color")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExportModal();
            }}
          >
            {t("Export page")}
          </Menu.Item>

          {!node.data.isSynced ? (
            <Menu.Item
              leftSection={<IconFileSymlink size={16} />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openCreateSyncedPageModal();
              }}
            >
              {t("New Synced Page")}
            </Menu.Item>
          ) : null}

          {isPersonalSpace && (
            <div>
              <Menu.Item
                leftSection={<IconUsers size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openShareModal();
                }}
              >
                {t("Share")}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item
                c="red"
                leftSection={<IconTrash size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDeleteModal({
                    onConfirm: () => treeApi?.delete(node),
                  });
                }}
              >
                {t("Delete")}
              </Menu.Item>
            </div>
          )}
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={colorPickerOpened}
        onClose={closeColorPicker}
        title={t("Choose a color")}
        size="sm"
      >
        <Stack>
          <ColorPicker
            format="hex"
            value={color}
            onChange={handleColorChange}
            swatches={[
              "#25262b",
              "#868e96",
              "#fa5252",
              "#e64980",
              "#be4bdb",
              "#7950f2",
              "#4c6ef5",
              "#228be6",
              "#15aabf",
              "#12b886",
              "#40c057",
              "#82c91e",
              "#fab005",
              "#fd7e14",
            ]}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeColorPicker}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => applyNewColor()}>{t("Apply")}</Button>
          </Group>
        </Stack>
      </Modal>

      <CreateSyncPageModal
        originPageId={node.id}
        onClose={closeCreateSyncedPageModal}
        open={createSyncedPageModelOpened}
        isPersonalSpace={true}
      />

      <ExportModal
        type="page"
        id={node.id}
        open={exportOpened}
        onClose={closeExportModal}
      />

      <PageShareModal
        pageId={node.id}
        opened={shareOpened}
        onClose={closeShareModal}
      />
    </>
  );
}
