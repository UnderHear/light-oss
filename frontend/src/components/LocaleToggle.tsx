import { LanguagesIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const buttonSize = size === "default" ? "icon" : "icon-sm";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("header.compactLanguageSwitch")}
        className={cn(
          buttonVariants({ size: buttonSize, variant: "outline" }),
          className,
        )}
        type="button"
      >
        <LanguagesIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-28" sideOffset={8}>
        {[
          { value: "zh-CN", label: "简体中文" },
          { value: "en-US", label: "English" },
        ].map((option) => (
          <DropdownMenuItem
            className="cursor-pointer"
            key={option.value}
            onSelect={() => setLocale(option.value as AppLocale)}
          >
            <span
              className={cn(
                "w-full",
                locale === option.value && "font-medium text-foreground",
              )}
            >
              {option.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
