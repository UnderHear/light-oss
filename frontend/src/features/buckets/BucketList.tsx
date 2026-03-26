import { ArrowUpRightIcon, Clock3Icon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Bucket } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function BucketList({ buckets }: { buckets: Bucket[] }) {
  const { locale, t } = useI18n();

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>{t("buckets.list.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("buckets.list.description", { count: buckets.length })}
          </p>
        </div>
        <Badge variant="secondary">
          {t("buckets.list.total", { count: buckets.length })}
        </Badge>
      </CardHeader>
      <CardContent className="px-0 pb-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("buckets.table.name")}</TableHead>
              <TableHead className="hidden md:table-cell">
                {t("buckets.table.createdAt")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("buckets.table.updatedAt")}
              </TableHead>
              <TableHead className="text-right">
                {t("buckets.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((bucket) => (
              <TableRow key={bucket.id}>
                <TableCell className="max-w-[280px]">
                  <div className="flex flex-col gap-1">
                    <Link
                      className="truncate font-medium transition-colors hover:text-primary"
                      to={`/buckets/${bucket.name}`}
                    >
                      {bucket.name}
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground md:hidden">
                      <Clock3Icon className="size-3.5" />
                      {formatDate(bucket.updated_at, locale)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(bucket.created_at, locale)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(bucket.updated_at, locale)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/buckets/${bucket.name}`}>
                      <ArrowUpRightIcon data-icon="inline-start" />
                      {t("common.open")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
