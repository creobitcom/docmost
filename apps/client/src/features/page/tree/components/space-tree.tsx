import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import { useAtom, atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import { ActionIcon, Menu, rem, Tooltip } from "@mantine/core";
import {
  IconArrowRight,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconFileDescription,
  IconFileExport,
  IconFileSymlink,
  IconLink,
  IconPlus,
  IconPointFilled,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import clsx from "clsx";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import {
  appendNodeChildren,
  buildTree,
  buildTreeWithChildren,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  getPageBreadcrumbs,
  getPageById,
  getSidebarPages,
} from "@/features/page/services/page-service.ts";
import { IPage, SidebarPagesParams } from "@/features/page/types/page.types.ts";
import { queryClient } from "@/main.tsx";
import { OpenMap } from "react-arborist/dist/main/state/open-slice";
import {
  useClipboard,
  useDisclosure,
  useElementSize,
  useMergedRef,
} from "@mantine/hooks";
import { dfs } from "react-arborist/dist/module/utils";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { getAppUrl } from "@/lib/config.ts";
import { extractPageSlugId } from "@/lib";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import PageShareModal from "../../components/share-modal";
import MovePageModal from "../../components/move-page-modal.tsx";
import CreateSyncPageModal from "../../components/create-sync-page-modal.tsx";
import {
  fetchAncestorChildren,
  useGetRootSidebarPagesQuery,
  usePageQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query.ts";

const treeDataAtomFamily = atomFamily((spaceId) => atom([]));
const openTreeNodesAtomFamily = atomFamily((spaceId) => atom<OpenMap>({}));
const treeApiAtomFamily = atomFamily((spaceId) =>
  atom<TreeApi<SpaceTreeNode>>(null),
);

interface SpaceTreeProps {
  spaceId: string;
  readOnly: boolean;
}

export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
  const { pageSlug } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [treeData, setTreeData] = useAtom(treeDataAtomFamily(spaceId));
  const treeApiRef = useRef<TreeApi<SpaceTreeNode>>();
  const [openTreeNodes, setOpenTreeNodes] = useAtom<OpenMap>(
    openTreeNodesAtomFamily(spaceId),
  );

  // Local state for tree controllers
  const [controllers, setControllers] = useState({
    onCreate: null,
    onMove: null,
    onRename: null,
    onDelete: null,
  });

  const rootElement = useRef(null);
  const { ref: sizeRef, width, height } = useElementSize();
  const mergedRef = useMergedRef(rootElement, sizeRef);
  const isDataLoaded = useRef(false);

  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const {
    data: pagesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useGetRootSidebarPagesQuery({
    spaceId,
  });

  // Custom hook to handle tree mutations
  const useTreeMutationHook = () => {
    const updateData = (newData) => {
      setTreeData(newData);
    };

    const handleCreate = (params) => {
      // Implementation of create logic
      console.log("Creating node", params);
    };

    const handleMove = (params) => {
      // Implementation of move logic
      console.log("Moving node", params);
    };

    const handleRename = (params) => {
      // Implementation of rename logic
      console.log("Renaming node", params);
    };

    const handleDelete = (params) => {
      // Implementation of delete logic
      console.log("Deleting node", params);
    };

    useEffect(() => {
      setControllers({
        onCreate: handleCreate,
        onMove: handleMove,
        onRename: handleRename,
        onDelete: handleDelete,
      });
    }, []);

    return {
      data: treeData,
      setData: updateData,
      controllers,
    };
  };

  const { setData } = useTreeMutationHook();

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching, spaceId]);

  useEffect(() => {
    if (pagesData?.pages && !hasNextPage) {
      const allItems = pagesData.pages.flatMap((page) => page.items);
      const treeData = buildTree(allItems);
      console.log(`SpaceId: ${spaceId}, pages: ${allItems.length}`);

      if (treeData.length > 0) {
        setData(treeData);
        isDataLoaded.current = true;
      }
    }
  }, [pagesData, hasNextPage, spaceId]);

  useEffect(() => {
    const fetchData = async () => {
      if (
        isDataLoaded.current &&
        currentPage &&
        currentPage.spaceId === spaceId
      ) {
        // check if pageId node is present in the tree
        const node = treeApiRef.current
          ? dfs(treeApiRef.current.root, currentPage.id)
          : null;
        if (node) {
          // if node is found, no need to traverse its ancestors
          return;
        }

        // if not found, fetch and build its ancestors and their children
        if (!currentPage.id) return;
        const ancestors = await getPageBreadcrumbs(currentPage.id);

        if (ancestors && ancestors.length > 1) {
          let flatTreeItems = [...buildTree(ancestors)];

          const fetchAndUpdateChildren = async (ancestor: IPage) => {
            // we don't want to fetch the children of the opened page
            if (ancestor.id === currentPage.id) {
              return;
            }
            const children = await fetchAncestorChildren({
              pageId: ancestor.id,
              spaceId: ancestor.spaceId,
            });

            flatTreeItems = [
              ...flatTreeItems,
              ...children.filter(
                (child) => !flatTreeItems.some((item) => item.id === child.id),
              ),
            ];
          };

          const fetchPromises = ancestors.map((ancestor) =>
            fetchAndUpdateChildren(ancestor),
          );

          // Wait for all fetch operations to complete
          Promise.all(fetchPromises).then(() => {
            // build tree with children
            const ancestorsTree = buildTreeWithChildren(flatTreeItems);
            // child of root page we're attaching the built ancestors to
            const rootChild = ancestorsTree[0];

            // attach built ancestors to tree
            const updatedTree = appendNodeChildren(
              treeData,
              rootChild.id,
              rootChild.children,
            );
            setData(updatedTree);

            setTimeout(() => {
              // focus on node and open all parents
              if (treeApiRef.current) {
                treeApiRef.current.select(currentPage.id);
              }
            }, 100);
          });
        }
      }
    };

    fetchData();
  }, [isDataLoaded.current, currentPage?.id, spaceId]);

  useEffect(() => {
    if (
      currentPage?.id &&
      currentPage.spaceId === spaceId &&
      treeApiRef.current
    ) {
      setTimeout(() => {
        // focus on node and open all parents
        treeApiRef.current?.select(currentPage.id, { align: "auto" });
      }, 200);
    } else if (treeApiRef.current) {
      treeApiRef.current?.deselectAll();
    }
  }, [currentPage?.id, spaceId]);

  useEffect(() => {
    // if (treeApiRef.current) {
    //   setTreeApi(treeApiRef.current);
    // }
  }, [treeApiRef.current]);

  const handleTreeRef = (ref) => {
    // treeApiRef.current = ref;
    // if (ref) {
    //   setTreeApi(ref);
    // }
  };

  return (
    <div ref={mergedRef} className={classes.treeContainer}>
      {rootElement.current && (
        <Tree
          data={treeData.filter((node) => node?.spaceId === spaceId)}
          disableDrag={readOnly}
          disableDrop={readOnly}
          disableEdit={readOnly}
          {...controllers}
          width={width || 300}
          height={height || 400}
          ref={handleTreeRef}
          openByDefault={false}
          disableMultiSelection={true}
          className={classes.tree}
          rowClassName={classes.row}
          rowHeight={30}
          overscanCount={10}
          dndRootElement={rootElement.current}
          onToggle={() => {
            if (treeApiRef.current) {
              setOpenTreeNodes(treeApiRef.current.openState);
            }
          }}
          initialOpenState={openTreeNodes}
        >
          {Node}
        </Tree>
      )}
    </div>
  );
}

function Node(
  { node, style, dragHandle, tree }: NodeRendererProps<any>,
  spaceId: string,
) {
  const navigate = useNavigate();
  const updatePageMutation = useUpdatePageMutation();

  const [treeData, setTreeData] = useAtom(treeDataAtomFamily(spaceId));
  const emit = useQueryEmit();
  const { spaceSlug } = useParams();
  const timerRef = useRef(null);
  const { t } = useTranslation();

  const prefetchPage = () => {
    timerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["pages", node.data.slugId],
        queryFn: () => getPageById({ pageId: node.data.slugId }),
        staleTime: 5 * 60 * 1000,
      });
    }, 150);
  };

  const cancelPagePrefetch = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  async function handleLoadChildren(node: NodeApi<SpaceTreeNode>) {
    if (!node.data.hasChildren) return;
    if (node.data.children && node.data.children.length > 0) {
      return;
    }

    try {
      const params: SidebarPagesParams = {
        pageId: node.data.id,
        spaceId: node.data.spaceId,
      };

      const newChildren = await queryClient.fetchQuery({
        queryKey: ["sidebar-pages", params],
        queryFn: () => getSidebarPages(params),
        staleTime: 10 * 60 * 1000,
      });

      const childrenTree = buildTree(newChildren.items);

      const updatedTreeData = appendNodeChildren(
        treeData,
        node.data.id,
        childrenTree,
      );

      setTreeData(updatedTreeData);
    } catch (error) {
      console.error("Failed to fetch children:", error);
    }
  }

  const handleClick = () => {
    const pageUrl = buildPageUrl(spaceSlug, node.data.slugId, node.data.name);
    navigate(pageUrl);
  };

  const handleUpdateNodeIcon = (nodeId: string, newIcon: string) => {
    const updatedTree = updateTreeNodeIcon(treeData, nodeId, newIcon);
    setTreeData(updatedTree);
  };

  const handleEmojiIconClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    handleUpdateNodeIcon(node.id, emoji.native);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: emoji.native });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: node.data.spaceId,
        entity: ["pages"],
        id: node.id,
        payload: { icon: emoji.native },
      });
    }, 50);
  };

  const handleRemoveEmoji = () => {
    handleUpdateNodeIcon(node.id, null);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: null });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: node.data.spaceId,
        entity: ["pages"],
        id: node.id,
        payload: { icon: null },
      });
    }, 50);
  };

  if (
    node.willReceiveDrop &&
    node.isClosed &&
    (node.children.length > 0 || node.data.hasChildren)
  ) {
    handleLoadChildren(node);
    setTimeout(() => {
      if (node.state.willReceiveDrop) {
        node.open();
      }
    }, 650);
  }

  return (
    <>
      <div
        style={style}
        className={clsx(classes.node, node.state)}
        ref={dragHandle}
        onClick={handleClick}
        onMouseEnter={prefetchPage}
        onMouseLeave={cancelPagePrefetch}
      >
        <PageArrow node={node} onExpandTree={() => handleLoadChildren(node)} />
        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            icon={
              node.data.icon ? (
                node.data.icon
              ) : (
                <IconFileDescription size="18" />
              )
            }
            readOnly={tree.props.disableEdit as boolean}
            removeEmojiAction={handleRemoveEmoji}
          />
        </div>

        <span className={classes.text}>{node.data.name || t("untitled")}</span>

        {node.data.isSynced ? <IconLink size="18" /> : null}

        <div className={classes.actions}>
          {!tree.props.disableEdit && (
            <CreateNode
              node={node}
              treeApi={tree}
              onExpandTree={() => handleLoadChildren(node)}
            />
          )}

          <NodeMenu node={node} treeApi={tree} />
        </div>
      </div>
    </>
  );
}

interface CreateNodeProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}

function CreateNode({ node, treeApi, onExpandTree }: CreateNodeProps) {
  function handleCreate() {
    if (node.data.hasChildren && node.children.length === 0) {
      node.toggle();
      onExpandTree();

      setTimeout(() => {
        treeApi?.create({ type: "internal", parentId: node.id, index: 0 });
      }, 500);
    } else {
      treeApi?.create({ type: "internal", parentId: node.id });
    }
  }

  return (
    <ActionIcon
      variant="transparent"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleCreate();
      }}
    >
      <IconPlus style={{ width: rem(20), height: rem(20) }} stroke={2} />
    </ActionIcon>
  );
}

interface NodeMenuProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
}

function NodeMenu({ node, treeApi }: NodeMenuProps) {
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 500 });
  const { spaceSlug } = useParams();
  const { openDeleteModal } = useDeletePageModal();

  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [shareOpened, { open: openShareModal, close: closeShareModal }] =
    useDisclosure(false);

  const [
    movePageModalOpened,
    { open: openMovePageModal, close: closeMoveSpaceModal },
  ] = useDisclosure(false);

  const [
    createSyncedPageModelOpened,
    { open: openCreateSyncedPageModal, close: closeCreateSyncedPageModal },
  ] = useDisclosure(false);

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, node.data.slugId, node.data.name);
    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
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
            leftSection={<IconLink size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyLink();
            }}
          >
            {t("Copy link")}
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

          {!(treeApi.props.disableEdit as boolean) && (
            <>
              <Menu.Item
                leftSection={<IconArrowRight size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openMovePageModal();
                }}
              >
                {t("Move")}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item
                c="red"
                leftSection={<IconTrash size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDeleteModal({ onConfirm: () => treeApi?.delete(node) });
                }}
              >
                {t("Delete")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <MovePageModal
        pageId={node.id}
        slugId={node.data.slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />

      <CreateSyncPageModal
        originPageId={node.id}
        currentSpaceSlug={spaceSlug}
        onClose={closeCreateSyncedPageModal}
        open={createSyncedPageModelOpened}
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

interface PageArrowProps {
  node: NodeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}

function PageArrow({ node, onExpandTree }: PageArrowProps) {
  return (
    <ActionIcon
      size={20}
      variant="subtle"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        node.toggle();
        onExpandTree();
      }}
    >
      {node.isInternal ? (
        node.children && (node.children.length > 0 || node.data.hasChildren) ? (
          node.isOpen ? (
            <IconChevronDown stroke={2} size={18} />
          ) : (
            <IconChevronRight stroke={2} size={18} />
          )
        ) : (
          <IconPointFilled size={8} />
        )
      ) : null}
    </ActionIcon>
  );
}
