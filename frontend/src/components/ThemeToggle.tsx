import { MoonStarIcon, SunMediumIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useAppPreferences, type AppTheme } from "@/lib/preferences";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  const {
    preferences: { theme },
    setTheme,
  } = useAppPreferences();
  const { t } = useI18n();

  return (
    <ToggleGroup
      aria-label={t("header.compactThemeSwitch")}
      className={cn("w-full justify-start", className)}
      onValueChange={(value) => {
        if (value) {
          setTheme(value as AppTheme);
        }
      }}
      size={size}
      type="single"
      value={theme}
      variant="outline"
    >
      <ToggleGroupItem value="light">
        <SunMediumIcon data-icon="inline-start" />
        {t("theme.light")}
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <MoonStarIcon data-icon="inline-start" />
        {t("theme.dark")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
