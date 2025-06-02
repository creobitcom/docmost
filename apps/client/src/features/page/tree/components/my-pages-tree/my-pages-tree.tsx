import { NodeApi, Tree, TreeApi } from "react-arborist";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useElementSize, useMergedRef } from "@mantine/hooks";
import {
  useCopyPageMutation,
  useCreateSyncPageMutation,
  useGetMyPagesQuery,
  usePageQuery,
} from "@/features/page/queries/page-query.ts";
import {
  getMyPages,
  getPageBreadcrumbs,
  movePageToSpace,
} from "@/features/page/services/page-service.ts";
import {
  buildTree,
  buildTreeWithChildren,
  appendNodeChildren,
} from "@/features/page/tree/utils/utils.ts";
import { extractPageSlugId } from "@/lib";
import { useMyPagesTreeMutation } from "@/features/my-pages/tree/hooks/use-tree-mutation.ts";
import { personalSpaceIdAtom } from "@/features/page/tree/atoms/tree-current-space-atom.ts";
import { reloadTreeAtom } from "@/features/page/atoms/reload-tree-atom.ts";
import { dfs } from "react-arborist/dist/module/utils";
import { queryClient } from "@/main.tsx";
import { Node } from "./my-page-tree-node.tsx";
import classes from "@/features/page/tree/styles/tree.module.css";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { useAtom } from "jotai";
import { usePageColors } from "../../hooks/use-page-colors.ts";
import { MoveOrCopyModal, onMoveActions } from "../move-or-copy-modal.tsx";

interface MyPagesTreeProps {
  spaceId: string;
  readOnly: boolean;
}

export default function MyPagesTree({ spaceId, readOnly }: MyPagesTreeProps) {
  const { pageSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);

  const { loadColors } = usePageColors();

  const [, setTreeApi] = useState<TreeApi<SpaceTreeNode> | null>(null);
  const [openTreeNodes, setOpenTreeNodes] = useState({});

  const [, setPersonalSpaceId] = useAtom(personalSpaceIdAtom);
  const [reloadTree] = useAtom(reloadTreeAtom);

  const treeApiRef = useRef<TreeApi<SpaceTreeNode> | null>(null);
  const rootElement = useRef<HTMLDivElement>(null);
  const isDataLoaded = useRef(false);

  const { ref: sizeRef, width } = useElementSize();
  const mergedRef = useMergedRef(rootElement, sizeRef);

  const {
    data: pagesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useGetMyPagesQuery();
  const { data: currentPage } = usePageQuery({ pageId });
  const { data, setData, controllers } = useMyPagesTreeMutation(spaceId);

  const copyPageMutation = useCopyPageMutation();
  const createSyncPageMutation = useCreateSyncPageMutation();

  const [pending, setPending] = useState<{
    dragIds: string[];
    dragNodes: NodeApi<SpaceTreeNode>[];
    parentId: string | null;
    parentNode: NodeApi<SpaceTreeNode> | null;
    index: number;
  } | null>(null);

  const handleMove = (args: {
    dragIds: string[];
    dragNodes: NodeApi<SpaceTreeNode>[];
    parentId: string | null;
    parentNode: NodeApi<SpaceTreeNode> | null;
    index: number;
  }) => {
    const originalNode = args.dragNodes[0];

    if (!originalNode) return;

    // @ts-ignore
    const draggedNodeSpaceId = originalNode.data.spaceId;
    // @ts-ignore
    const draggedNodeHasParentPage = Boolean(originalNode.data.parentPageId);
    // @ts-ignore
    const targetSpaceId = args.parentNode?.data?.spaceId;

    const isMovingToAnotherSpace =
      draggedNodeSpaceId !== spaceId && draggedNodeHasParentPage;
    const isTargetInDifferentSpace =
      args.parentId && draggedNodeSpaceId !== targetSpaceId;
    const isTargetNotInCurrentSpace =
      args.parentId && spaceId !== targetSpaceId;

    if (
      isMovingToAnotherSpace ||
      isTargetInDifferentSpace ||
      isTargetNotInCurrentSpace
    ) {
      setPending(args);
    } else {
      controllers.onMove(args);
    }
  };

  const handleConfirm = (action: onMoveActions) => {
    if (!pending) return;

    const originPage = pending.dragNodes[0];
    const originPageId = originPage.id;
    const parentPageId = pending.parentId;
    const targetSpaceId = pending.parentNode?.data?.spaceId ?? spaceId;

    console.log("[move page]", {
      dragedPageId: originPageId,
      parentPageId,
      targetSpaceId,
    });

    switch (action) {
      case "copy": {
        copyPageMutation.mutate(
          {
            originPageId,
            spaceId: targetSpaceId,
            parentPageId,
          },
          // {
          //   onSuccess: (newPage) => {
          //     controllers.onMove(pending);
          //     console.log(data);
          //     const movedPage = data.find((page) => page.id === dragedPageId);
          //     movedPage.spaceId = targetSpaceId;
          //     movedPage.parentPageId = parentPageId;
          //   },
          // },
        );
        break;
      }
      case "sync": {
        createSyncPageMutation.mutate({
          originPageId: originPageId,
          spaceId: targetSpaceId,
          parentPageId,
        });
        break;
      }
      case "move": {
        movePageToSpace({
          pageId: originPageId,
          spaceId: targetSpaceId,
          parentPageId,
        });
        break;
      }
    }

    setPending(null);
  };

  const focusPage = useCallback((id: string) => {
    setTimeout(() => {
      treeApiRef.current?.select(id, { align: "auto" });
    }, 200);
  }, []);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["my-pages"] });
    setData([]);
    isDataLoaded.current = false;
  }, [reloadTree]);

  useEffect(() => {
    setPersonalSpaceId(spaceId);
  }, [spaceId]);

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching]);

  useEffect(() => {
    if (pagesData?.pages && !hasNextPage) {
      const allItems = pagesData.pages.flatMap((page) => page.items);
      const treeData = buildTree(allItems);

      loadColors(allItems);

      if (data.length < 1 || data[0].spaceId !== spaceId) {
        setData(treeData);
        isDataLoaded.current = true;
        setOpenTreeNodes({});
      }
    }
  }, [pagesData, hasNextPage, spaceId]);

  useEffect(() => {
    const loadAncestors = async () => {
      if (!isDataLoaded.current || !currentPage?.id) return;

      const inTree = dfs(treeApiRef.current?.root, currentPage.id);
      if (inTree) return;

      const ancestors = await getPageBreadcrumbs(currentPage.id);
      if (!ancestors || ancestors.length <= 1) return;

      let flatTreeItems = buildTree(ancestors);

      await Promise.all(
        ancestors.map(async (ancestor) => {
          if (ancestor.id === currentPage.id) return;
          const pages = await getMyPages(ancestor.id);
          const children = buildTree(pages.items);

          flatTreeItems = [
            ...flatTreeItems,
            ...children.filter(
              (child) => !flatTreeItems.some((item) => item.id === child.id),
            ),
          ];
        }),
      );

      const ancestorsTree = buildTreeWithChildren(flatTreeItems);
      const rootChild = ancestorsTree[0];
      const updatedTree = appendNodeChildren(
        data,
        rootChild.id,
        rootChild.children,
      );

      setData(updatedTree);
      focusPage(currentPage.id);
    };

    loadAncestors();
  }, [currentPage?.id]);

  useEffect(() => {
    if (currentPage?.id) {
      focusPage(currentPage.id);
    } else {
      treeApiRef.current?.deselectAll();
    }
  }, [currentPage?.id, focusPage]);

  const handleTreeApi = useCallback((api: TreeApi<SpaceTreeNode> | null) => {
    if (api) {
      treeApiRef.current = api;
      setTreeApi(api);
    }
  }, []);

  return (
    <div ref={mergedRef} className={classes.treeContainer}>
      {rootElement.current && (
        <Tree
          data={data}
          disableDrag={readOnly}
          disableDrop={readOnly}
          disableEdit={readOnly}
          {...controllers}
          width={width}
          height={rootElement.current.clientHeight}
          ref={handleTreeApi}
          openByDefault={false}
          disableMultiSelection
          className={classes.tree}
          rowClassName={classes.row}
          rowHeight={30}
          overscanCount={10}
          dndRootElement={rootElement.current}
          onToggle={() => setOpenTreeNodes(treeApiRef.current?.openState || {})}
          initialOpenState={openTreeNodes}
          onMove={(args) => {
            handleMove(args);
          }}
        >
          {Node}
        </Tree>
      )}
      {pending && (
        <MoveOrCopyModal
          opened={!!pending}
          onClose={() => setPending(null)}
          dragNodeLabel={pending?.dragNodes[0].data.name ?? ""}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
