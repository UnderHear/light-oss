import { MoonStarIcon, SunMediumIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppPreferences } from "@/lib/preferences";
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
  const buttonSize = size === "default" ? "icon" : "icon-sm";

  return (
    <Button
      aria-label={t("header.compactThemeSwitch")}
      className={cn(className)}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      size={buttonSize}
      type="button"
      variant="outline"
    >
      {theme === "light" ? <SunMediumIcon /> : <MoonStarIcon />}
    </Button>
  );
}
