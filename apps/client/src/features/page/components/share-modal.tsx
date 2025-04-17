import { Modal, rem, Group, Text, Tabs } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { usePageQuery } from "../queries/page-query";
import { usePageAbility } from "../permissions/use-page-ability";
import PageMembersList from "./page-members";
import AddPageMembersModal from "./add-page-members-modal";
import PermissionsPanel from "@/features/permission/components/permissions-panel";
import {
  PageCaslAction,
  PageCaslObject,
} from "@/features/permission/constants/casl";

interface PageShareModalParams {
  pageId: string;
  opened: boolean;
  onClose: () => void;
}

export default function PageShareModal({
  pageId,
  opened,
  onClose,
}: PageShareModalParams) {
  const { t } = useTranslation();
  const { data: page } = usePageQuery({ pageId });

  const pageRules = page?.membership?.permissions;
  const pageAbility = usePageAbility(pageRules);

  const canManagePermission =
    page && pageAbility.can(PageCaslAction.Manage, PageCaslObject.Permission);

  return (
    <>
      <Modal.Root
        opened={opened}
        onClose={onClose}
        size={600}
        padding="xl"
        yOffset="10vh"
        xOffset={0}
        mah={400}
      >
        <Modal.Overlay />
        <Modal.Content style={{ overflow: "hidden" }}>
          <Modal.Header py={0}>
            <Modal.Title>
              <Text fw={500} lineClamp={1}>
                {`Share - ${page?.title}`}
              </Text>
            </Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>
            <div style={{ height: rem(600) }}>
              <Tabs defaultValue="members">
                <Tabs.List>
                  <Tabs.Tab fw={500} value="members">
                    {t("Members")}
                  </Tabs.Tab>
                  <Tabs.Tab fw={500} value="permissions">
                    {t("Permissions")}
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="members">
                  <Group my="md" justify="flex-end">
                    {canManagePermission && (
                      <AddPageMembersModal pageId={page?.id} />
                    )}
                  </Group>
                  <PageMembersList
                    pageId={page?.id}
                    readOnly={!canManagePermission}
                  />
                </Tabs.Panel>

                <Tabs.Panel my="md" value="permissions">
                  {page && (
                    <PermissionsPanel
                      targetId={page.id}
                      type="page"
                      readOnly={!canManagePermission}
                    />
                  )}
                </Tabs.Panel>
              </Tabs>
            </div>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
