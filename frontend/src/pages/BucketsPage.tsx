import { useQuery } from "@tanstack/react-query";
import { BoxesIcon, CircleAlertIcon } from "lucide-react";
import { listBuckets } from "@/api/buckets";
import { EmptyState } from "@/components/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BucketList } from "@/features/buckets/BucketList";
import { useI18n } from "@/lib/i18n";
import { useAppSettings } from "@/lib/settings";

export function BucketsPage() {
  const { settings } = useAppSettings();
  const { t } = useI18n();

  const bucketsQuery = useQuery({
    queryKey: ["buckets", settings.apiBaseUrl, settings.bearerToken],
    queryFn: () => listBuckets(settings),
    enabled: settings.apiBaseUrl.trim() !== "",
  });

  const buckets = bucketsQuery.data?.items ?? [];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Badge className="w-fit gap-1.5" variant="outline">
            <BoxesIcon className="size-3.5" />
            {t("buckets.title")}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("buckets.title")}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t("buckets.description")}
          </p>
        </div>
      </div>

      {bucketsQuery.isLoading ? <BucketsLoadingState /> : null}

      {bucketsQuery.isError ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t("errors.loadBuckets")}</AlertTitle>
          <AlertDescription>{bucketsQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {!bucketsQuery.isLoading &&
      !bucketsQuery.isError &&
      bucketsQuery.data &&
      buckets.length > 0 ? (
        <BucketList buckets={buckets} />
      ) : null}

      {!bucketsQuery.isLoading &&
      !bucketsQuery.isError &&
      bucketsQuery.data &&
      buckets.length === 0 ? (
        <EmptyState
          description={t("buckets.empty.description")}
          icon={BoxesIcon}
          title={t("buckets.empty.title")}
        />
      ) : null}
    </section>
  );
}

function BucketsLoadingState() {
  return (
    <div className="grid gap-4">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <div className="grid gap-2 pt-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
