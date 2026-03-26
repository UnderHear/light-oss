import { FormEvent, useState } from "react";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export function CreateBucketForm({
  onSubmit,
  pending,
}: {
  onSubmit: (name: string) => Promise<void>;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const { t } = useI18n();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    await onSubmit(name.trim());
    setName("");
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>{t("buckets.create.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("buckets.create.description")}
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            <Field data-disabled={pending || undefined}>
              <FieldLabel htmlFor="bucket-name">
                {t("buckets.form.name.label")}
              </FieldLabel>
              <Input
                disabled={pending}
                id="bucket-name"
                onChange={(event) => setName(event.target.value)}
                placeholder={t("buckets.form.name.placeholder")}
                value={name}
              />
              <FieldDescription>
                {t("buckets.form.name.description")}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={pending || !name.trim()} type="submit">
            {pending ? (
              <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
            ) : (
              <PlusIcon data-icon="inline-start" />
            )}
            {pending
              ? t("buckets.form.submitting")
              : t("buckets.form.submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
