import { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  HardDriveIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { FolderTreeNode } from "@/lib/explorer";
import { isExplorerPrefixAncestor } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function FolderTree({
  activePrefix,
  bucketName,
  loading,
  nodes,
  onNavigate,
}: {
  activePrefix: string;
  bucketName: string;
  loading: boolean;
  nodes: FolderTreeNode[];
  onNavigate: (prefix: string) => void;
}) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const { t } = useI18n();

  useEffect(() => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      for (const node of flattenTree(nodes)) {
        if (isExplorerPrefixAncestor(node.path, activePrefix)) {
          next.delete(node.path);
        }
      }
      return next;
    });
  }, [activePrefix, nodes]);

  const folderCount = useMemo(() => flattenTree(nodes).length, [nodes]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t("explorer.tree.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("explorer.tree.count", { count: folderCount })}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 py-3">
        <div className="flex flex-col gap-1 pr-2">
          <Button
            className="justify-start gap-2"
            onClick={() => onNavigate("")}
            type="button"
            variant={activePrefix === "" ? "secondary" : "ghost"}
          >
            <HardDriveIcon data-icon="inline-start" />
            <span className="truncate">{bucketName}</span>
          </Button>

          {loading ? (
            <FolderTreeLoading />
          ) : nodes.length > 0 ? (
            nodes.map((node) => (
              <FolderTreeNodeItem
                activePrefix={activePrefix}
                collapsedPaths={collapsedPaths}
                depth={0}
                key={node.path}
                node={node}
                onNavigate={onNavigate}
                setCollapsedPaths={setCollapsedPaths}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-sm text-muted-foreground">
              {t("explorer.tree.empty")}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FolderTreeNodeItem({
  activePrefix,
  collapsedPaths,
  depth,
  node,
  onNavigate,
  setCollapsedPaths,
}: {
  activePrefix: string;
  collapsedPaths: Set<string>;
  depth: number;
  node: FolderTreeNode;
  onNavigate: (prefix: string) => void;
  setCollapsedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const isCollapsed = collapsedPaths.has(node.path);
  const isActive = activePrefix === node.path;
  const hasChildren = node.children.length > 0;

  return (
    <Collapsible open={!isCollapsed}>
      <div className="flex items-center gap-1">
        <div style={{ width: `${depth * 14}px` }} />
        {hasChildren ? (
          <Button
            className="shrink-0"
            onClick={() =>
              setCollapsedPaths((current) => {
                const next = new Set(current);
                if (next.has(node.path)) {
                  next.delete(node.path);
                } else {
                  next.add(node.path);
                }
                return next;
              })
            }
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            <span className="sr-only">Toggle folder</span>
          </Button>
        ) : (
          <span className="inline-flex size-6 shrink-0" />
        )}
        <Button
          className={cn(
            "min-w-0 flex-1 justify-start gap-2 truncate px-2",
            isActive ? "font-medium" : "font-normal",
          )}
          onClick={() => onNavigate(node.path)}
          type="button"
          variant={isActive ? "secondary" : "ghost"}
        >
          {isActive ? <FolderOpenIcon data-icon="inline-start" /> : <FolderIcon data-icon="inline-start" />}
          <span className="truncate">{node.name}</span>
        </Button>
      </div>

      {hasChildren ? (
        <CollapsibleContent className="overflow-hidden">
          <div className="mt-1 flex flex-col gap-1">
            {node.children.map((child) => (
              <FolderTreeNodeItem
                activePrefix={activePrefix}
                collapsedPaths={collapsedPaths}
                depth={depth + 1}
                key={child.path}
                node={child}
                onNavigate={onNavigate}
                setCollapsedPaths={setCollapsedPaths}
              />
            ))}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

function FolderTreeLoading() {
  return (
    <div className="flex flex-col gap-2 px-2 pt-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="flex items-center gap-2" key={index}>
          <Skeleton className="size-6" />
          <Skeleton className="h-7 flex-1" />
        </div>
      ))}
    </div>
  );
}

function flattenTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
  const items: FolderTreeNode[] = [];
  for (const node of nodes) {
    items.push(node);
    items.push(...flattenTree(node.children));
  }
  return items;
}
