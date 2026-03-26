import {
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react";
import type { ExplorerDirectoryEntry, ExplorerEntry, ExplorerFileEntry } from "@/api/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function ExplorerTable({
  bucket,
  buildPublicUrl,
  deletingPath,
  entries,
  onDeleteFile,
  onDeleteFolder,
  onOpenDirectory,
  onSignDownload,
  signingPath,
}: {
  bucket: string;
  buildPublicUrl: (objectKey: string) => string;
  deletingPath: string;
  entries: ExplorerEntry[];
  onDeleteFile: (objectKey: string) => Promise<void>;
  onDeleteFolder: (folderPath: string) => Promise<void>;
  onOpenDirectory: (folderPath: string) => void;
  onSignDownload: (objectKey: string) => Promise<void>;
  signingPath: string;
}) {
  const { locale, t } = useI18n();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[360px] max-w-[360px] text-base font-semibold text-muted-foreground">
            {t("explorer.table.name")}
          </TableHead>
          <TableHead className="w-[280px] text-base font-semibold text-muted-foreground">
            {t("explorer.table.url")}
          </TableHead>
          <TableHead className="w-[120px] text-base font-semibold text-muted-foreground">
            {t("explorer.table.size")}
          </TableHead>
          <TableHead className="w-[160px] text-base font-semibold text-muted-foreground">
            {t("explorer.table.storageType")}
          </TableHead>
          <TableHead className="w-[220px] text-base font-semibold text-muted-foreground">
            {t("explorer.table.updatedAt")}
          </TableHead>
          <TableHead className="w-[180px] text-base font-semibold text-muted-foreground">
            {t("explorer.table.actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.path}>
            <TableCell className="w-[360px] max-w-[360px]">
              <ExplorerEntryNameButton entry={entry} onOpenDirectory={onOpenDirectory} />
            </TableCell>
            <TableCell className="max-w-[280px]">
              <ExplorerEntryUrlCell
                buildPublicUrl={buildPublicUrl}
                copyLabel={t("explorer.actions.copyUrl")}
                entry={entry}
              />
            </TableCell>
            <TableCell className={entry.type === "directory" ? "text-muted-foreground" : undefined}>
              {entry.type === "directory" ? "-" : formatBytes(entry.size)}
            </TableCell>
            <TableCell className={entry.type === "directory" ? "text-muted-foreground" : undefined}>
              {entry.type === "directory" ? (
                "-"
              ) : (
                <Badge variant={entry.visibility === "public" ? "secondary" : "outline"}>
                  {entry.visibility === "public"
                    ? t("objects.visibility.public")
                    : t("objects.visibility.private")}
                </Badge>
              )}
            </TableCell>
            <TableCell className={entry.type === "directory" ? "text-muted-foreground" : undefined}>
              {entry.type === "directory" ? "-" : formatDate(entry.updated_at, locale)}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-start gap-1">
                {entry.type === "directory" ? (
                  <>
                    <ExplorerIconButton
                      label={t("explorer.actions.openFolder")}
                      onClick={() => onOpenDirectory(entry.path)}
                    >
                      <FolderOpenIcon className="text-amber-500" />
                    </ExplorerIconButton>

                    {entry.is_empty ? (
                      <DeleteFolderButton
                        bucket={bucket}
                        deletingPath={deletingPath}
                        entry={entry}
                        onDeleteFolder={onDeleteFolder}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    {entry.visibility === "public" ? (
                      <ExplorerIconLink
                        href={buildPublicUrl(entry.object_key)}
                        label={t("explorer.actions.directDownload")}
                      >
                        <DownloadIcon className="text-sky-500" />
                      </ExplorerIconLink>
                    ) : (
                      <ExplorerIconButton
                        disabled={signingPath === entry.path}
                        label={t("explorer.actions.signedDownload")}
                        onClick={() => void onSignDownload(entry.object_key)}
                      >
                        {signingPath === entry.path ? (
                          <LoaderCircleIcon className="animate-spin text-sky-500" />
                        ) : (
                          <DownloadIcon className="text-sky-500" />
                        )}
                      </ExplorerIconButton>
                    )}

                    <DeleteFileButton
                      bucket={bucket}
                      deletingPath={deletingPath}
                      entry={entry}
                      onDeleteFile={onDeleteFile}
                    />
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ExplorerEntryNameButton({
  entry,
  onOpenDirectory,
}: {
  entry: ExplorerEntry;
  onOpenDirectory: (folderPath: string) => void;
}) {
  let icon: React.ReactNode;
  let onClick: (() => void) | undefined;

  switch (entry.type) {
    case "directory":
      icon = (
        <span className="inline-flex size-4 items-center justify-center text-amber-500 [&_svg]:size-4">
          <FolderIcon data-icon="inline-start" />
        </span>
      );
      onClick = () => onOpenDirectory(entry.path);
      break;
    case "file":
      icon = (
        <span className="inline-flex size-4 items-center justify-center [&_svg]:size-4">
          <FileTextIcon data-icon="inline-start" />
        </span>
      );
      break;
    default: {
      const exhaustiveEntry: never = entry;
      return exhaustiveEntry;
    }
  }

  return (
    <Button
      className="w-full max-w-full min-w-0 justify-start gap-2 px-0 font-normal hover:bg-transparent cursor-pointer"
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      {icon}
      <span className="min-w-0 truncate">{entry.name}</span>
    </Button>
  );
}

function ExplorerEntryUrlCell({
  buildPublicUrl,
  copyLabel,
  entry,
}: {
  buildPublicUrl: (objectKey: string) => string;
  copyLabel: string;
  entry: ExplorerEntry;
}) {
  if (entry.type !== "file" || entry.visibility !== "public") {
    return <span className="text-muted-foreground">-</span>;
  }

  const url = buildPublicUrl(entry.object_key);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <a
        className="block min-w-0 flex-1 truncate text-sky-600 hover:underline"
        href={url}
        rel="noreferrer"
        target="_blank"
        title={url}
      >
        {url}
      </a>
      <ExplorerIconButton
        label={copyLabel}
        onClick={() => {
          void navigator.clipboard.writeText(url).catch(() => undefined);
        }}
      >
        <CopyIcon className="text-sky-500" />
      </ExplorerIconButton>
    </div>
  );
}

function DeleteFolderButton({
  bucket,
  deletingPath,
  entry,
  onDeleteFolder,
}: {
  bucket: string;
  deletingPath: string;
  entry: ExplorerDirectoryEntry;
  onDeleteFolder: (folderPath: string) => Promise<void>;
}) {
  const { t } = useI18n();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <span className="inline-flex">
          <ExplorerIconButton
            disabled={deletingPath === entry.path}
            label={t("explorer.actions.deleteFolder")}
            onClick={() => undefined}
          >
            {deletingPath === entry.path ? (
              <LoaderCircleIcon className="animate-spin text-destructive" />
            ) : (
              <Trash2Icon className="text-destructive" />
            )}
          </ExplorerIconButton>
        </span>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("explorer.deleteFolder.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("explorer.deleteFolder.description", {
              bucket,
              name: entry.name,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onDeleteFolder(entry.path)}
            variant="destructive"
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteFileButton({
  bucket,
  deletingPath,
  entry,
  onDeleteFile,
}: {
  bucket: string;
  deletingPath: string;
  entry: ExplorerFileEntry;
  onDeleteFile: (objectKey: string) => Promise<void>;
}) {
  const { t } = useI18n();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <span className="inline-flex">
          <ExplorerIconButton
            disabled={deletingPath === entry.object_key}
            label={t("common.delete")}
            onClick={() => undefined}
          >
            {deletingPath === entry.object_key ? (
              <LoaderCircleIcon className="animate-spin text-destructive" />
            ) : (
              <Trash2Icon className="text-destructive" />
            )}
          </ExplorerIconButton>
        </span>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("objects.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("objects.delete.description", {
              bucket,
              objectKey: entry.object_key,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onDeleteFile(entry.object_key)}
            variant="destructive"
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ExplorerIconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            className="[&_svg]:size-4"
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {children}
            <span className="sr-only">{label}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="whitespace-nowrap leading-none" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ExplorerIconLink({
  children,
  href,
  label,
}: {
  children: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button asChild className="[&_svg]:size-4" size="icon-sm" variant="ghost">
            <a href={href} rel="noreferrer" target="_blank">
              {children}
              <span className="sr-only">{label}</span>
            </a>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="whitespace-nowrap leading-none" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
