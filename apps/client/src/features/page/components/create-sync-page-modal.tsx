import { Modal, Button, Group, Text, Select, Stack } from "@mantine/core";
import { getSidebarPages } from "@/features/page/services/page-service.ts";
import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select.tsx";
import { useNavigate } from "react-router-dom";
import Page from "@/pages/page/page";

interface CreateSyncPageModalProps {
  currentSpaceSlug: string;
  open: boolean;
  onClose: () => void;
}

interface PageOption {
  value: string;
  label: string;
}

export default function CreateSyncPageModal({
  currentSpaceSlug,
  open,
  onClose,
}: CreateSyncPageModalProps) {
  const { t } = useTranslation();
  const [targetSpace, setTargetSpace] = useState<ISpace>(null);
  const [targetPageId, setTargetPageId] = useState<string>("");
  const [pages, setPages] = useState<PageOption[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false);

  useEffect(() => {
    if (targetSpace) {
      fetchPagesList();
    } else {
      setPages([]);
      setTargetPageId("");
    }
  }, [targetSpace]);

  const fetchPagesList = async () => {
    if (!targetSpace) return;

    setIsLoadingPages(true);

    const pagesData = await getSidebarPages({
      spaceId: targetSpace.id,
    }).catch((error) => {
      notifications.show({
        message: error.response?.data.message || "Failed to fetch pages",
        color: "red",
      });
    });

    if (!pagesData) {
      setIsLoadingPages(false);
      return;
    }

    const pageOptions = pagesData.items.map((page) => ({
      value: page.id,
      label: page.title || "Untitled Page",
    }));

    console.log(pageOptions);

    setPages(pageOptions);
    setIsLoadingPages(false);
  };

  const handlePageMove = async () => {
    if (!targetSpace) return;
    // try {
    //   await movePageToSpace({
    //     pageId,
    //     spaceId: targetSpace.id,
    //     targetPageId: targetPageId || undefined,
    //   });

    //   queryClient.removeQueries({
    //     predicate: (item) =>
    //       ["pages", "sidebar-pages", "root-sidebar-pages"].includes(
    //         item.queryKey[0] as string,
    //       ),
    //   });

    //   const pageUrl = buildPageUrl(targetSpace.slug, slugId, undefined);
    //   navigate(pageUrl);

    notifications.show({
      message: t("Successfully created synced page"),
    });

    onClose();
    // } catch (err) {
    //   notifications.show({
    //     message: err.response?.data.message || "An error occurred",
    //     color: "red",
    //   });
    //   console.log(err);
    // }
    setTargetSpace(null);
    setTargetPageId("");
  };

  const handleSpaceChange = (space: ISpace) => {
    setTargetSpace(space);
  };

  const handlePageChange = (value: string) => {
    setTargetPageId(value);
  };

  return (
    <Modal.Root
      opened={open}
      onClose={onClose}
      size={500}
      padding="xl"
      yOffset="10vh"
      xOffset={0}
      mah={400}
      onClick={(e) => e.stopPropagation()}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{t("Create synchronized page")}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Text mb="xs" c="dimmed" size="sm">
            {t("Create a synchronized page in a different space.")}
          </Text>
          <Stack>
            <SpaceSelect
              value={currentSpaceSlug}
              clearable={false}
              onChange={handleSpaceChange}
              label={t("Select target space")}
            />

            <Select
              label={t("Select parent page (optional)")}
              placeholder={t("Choose a parent page")}
              data={pages}
              value={targetPageId}
              onChange={handlePageChange}
              clearable
              searchable
              disabled={!targetSpace}
              nothingFoundMessage={t("No page found")}
              onClick={(e) => e.stopPropagation()}
            />
          </Stack>

          <Group justify="end" mt="md">
            <Button onClick={onClose} variant="default">
              {t("Cancel")}
            </Button>
            <Button onClick={handlePageMove} disabled={!targetSpace}>
              {t("Create")}
            </Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
