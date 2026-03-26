import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useAppPreferences, type AppLocale } from "@/lib/preferences";
import { useI18n } from "@/lib/i18n";

export function LocaleToggle({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  const {
    preferences: { locale },
    setLocale,
  } = useAppPreferences();
  const { t } = useI18n();

  return (
    <ToggleGroup
      aria-label={t("header.compactLanguageSwitch")}
      className={cn("w-full justify-start", className)}
      onValueChange={(value) => {
        if (value) {
          setLocale(value as AppLocale);
        }
      }}
      size={size}
      type="single"
      value={locale}
      variant="outline"
    >
      <ToggleGroupItem value="en-US">{t("locale.en")}</ToggleGroupItem>
      <ToggleGroupItem value="zh-CN">{t("locale.zh")}</ToggleGroupItem>
    </ToggleGroup>
  );
}
