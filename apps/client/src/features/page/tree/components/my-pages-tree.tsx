import { Tree, TreeApi } from "react-arborist";
import { atom, useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import {
  useGetMyPagesQuery,
  usePageQuery,
} from "@/features/page/queries/page-query.ts";
import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import {
  appendNodeChildren,
  buildTree,
  buildTreeWithChildren,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  getMyPages,
  getPageBreadcrumbs,
} from "@/features/page/services/page-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { OpenMap } from "react-arborist/dist/main/state/open-slice";
import { useElementSize, useMergedRef } from "@mantine/hooks";
import { dfs } from "react-arborist/dist/module/utils";
import { extractPageSlugId } from "@/lib";
import { colorAtom as pageColorsAtom } from "../atoms/tree-color-atom.ts";
import { personalSpaceIdAtom } from "../atoms/tree-current-space-atom.ts";
import { useMyPagesTreeMutation } from "@/features/my-pages/tree/hooks/use-tree-mutation.ts";
import { Node } from "./my-page-tree-node.tsx";
import { queryClient } from "@/main.tsx";
import { reloadTreeAtom } from "../../atoms/reload-tree-atom.ts";

interface MyPagesTreeProps {
  spaceId: string;
  readOnly: boolean;
}

const openTreeNodesAtom = atom<OpenMap>({});

export default function MyPagesTree({ spaceId, readOnly }: MyPagesTreeProps) {
  const { pageSlug } = useParams();

  const { data, setData, controllers } =
    useMyPagesTreeMutation<TreeApi<SpaceTreeNode>>(spaceId);
  const {
    data: pagesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useGetMyPagesQuery();
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const [reloadTree] = useAtom(reloadTreeAtom);
  const [, setTreeApi] = useAtom<TreeApi<SpaceTreeNode>>(treeApiAtom);
  const [openTreeNodes, setOpenTreeNodes] = useAtom<OpenMap>(openTreeNodesAtom);
  const [, setPersonalSpaceId] = useAtom<string>(personalSpaceIdAtom);
  const [, setPageColors] = useAtom(pageColorsAtom);

  const treeApiRef = useRef<TreeApi<SpaceTreeNode>>();
  const rootElement = useRef<HTMLDivElement>();
  const { ref: sizeRef, width } = useElementSize();
  const mergedRef = useMergedRef(rootElement, sizeRef);
  const isDataLoaded = useRef(false);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["my-pages"] });
    setData([]);
    isDataLoaded.current = false;
  }, [reloadTree]);

  const loadColors = (pages: any[]) => {
    const colors = ["#4CAF50", "#2196F3", "#9C27B0", "#FF9800", "#E91E63"];
    const loadedColors = pages.reduce(
      (acc, page) => ({
        ...acc,
        [page.id]:
          page.color ?? colors[Math.floor(Math.random() * colors.length)],
      }),
      {},
    );
    setPageColors((prev) => ({ ...prev, ...loadedColors }));
  };

  useEffect(() => {
    setPersonalSpaceId(spaceId);
  }, [spaceId]);

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching, spaceId]);

  useEffect(() => {
    if (pagesData?.pages && !hasNextPage) {
      const allItems = pagesData.pages.flatMap((page) => page.items);
      const treeData = buildTree(allItems);

      loadColors(allItems);

      if (data.length < 1 || data?.[0].spaceId !== spaceId) {
        setData(treeData);
        isDataLoaded.current = true;
        setOpenTreeNodes({});
      }
    }
  }, [pagesData, hasNextPage]);

  useEffect(() => {
    const fetchData = async () => {
      if (isDataLoaded.current && currentPage) {
        // check if pageId node is present in the tree
        const node = dfs(treeApiRef.current?.root, currentPage.id);
        if (node) {
          // if node is found, no need to traverse its ancestors
          return;
        }

        // if not found, fetch and build its ancestors and their children
        if (!currentPage.id) return;
        const ancestors = await getPageBreadcrumbs(currentPage.id);

        if (ancestors && ancestors?.length > 1) {
          let flatTreeItems = [...buildTree(ancestors)];

          const fetchAndUpdateChildren = async (ancestor: IPage) => {
            // we don't want to fetch the children of the opened page
            if (ancestor.id === currentPage.id) {
              return;
            }

            const pages = await getMyPages(ancestor.id);
            const children = buildTree(pages.items);

            loadColors(pages.items);

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
              data,
              rootChild.id,
              rootChild.children,
            );
            setData(updatedTree);

            setTimeout(() => {
              // focus on node and open all parents
              treeApiRef.current.select(currentPage.id);
            }, 100);
          });
        }
      }
    };

    fetchData();
  }, [isDataLoaded.current, currentPage?.id]);

  useEffect(() => {
    if (currentPage?.id) {
      setTimeout(() => {
        // focus on node and open all parents
        treeApiRef.current?.select(currentPage.id, { align: "auto" });
      }, 200);
    } else {
      treeApiRef.current?.deselectAll();
    }
  }, [currentPage?.id]);

  useEffect(() => {
    if (treeApiRef.current) {
      // @ts-ignore
      setTreeApi(treeApiRef.current);
    }
  }, [treeApiRef.current]);

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
          ref={treeApiRef}
          openByDefault={false}
          disableMultiSelection={true}
          className={classes.tree}
          rowClassName={classes.row}
          rowHeight={30}
          overscanCount={10}
          dndRootElement={rootElement.current}
          onToggle={() => {
            setOpenTreeNodes(treeApiRef.current?.openState);
          }}
          initialOpenState={openTreeNodes}
        >
          {Node}
        </Tree>
      )}
    </div>
  );
}
