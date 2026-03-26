import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AppLocale = "en-US" | "zh-CN";
export type AppTheme = "light" | "dark";

export interface AppPreferences {
  locale: AppLocale;
  theme: AppTheme;
}

interface PreferencesContextValue {
  preferences: AppPreferences;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: AppTheme) => void;
}

const storageKey = "light-oss-preferences";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
  initialPreferences,
}: {
  children: ReactNode;
  initialPreferences?: AppPreferences;
}) {
  const [preferences, setPreferences] = useState<AppPreferences>(
    () => initialPreferences ?? loadPreferences(),
  );

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    document.documentElement.lang = preferences.locale;
    document.documentElement.classList.toggle(
      "dark",
      preferences.theme === "dark",
    );
    document.documentElement.style.colorScheme = preferences.theme;
  }, [preferences]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        setLocale: (locale) =>
          setPreferences((current) => ({
            ...current,
            locale,
          })),
        setTheme: (theme) =>
          setPreferences((current) => ({
            ...current,
            theme,
          })),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used within PreferencesProvider");
  }

  return context;
}

function loadPreferences(): AppPreferences {
  const fallback = {
    locale: detectLocale(),
    theme: detectTheme(),
  } satisfies AppPreferences;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      locale:
        parsed.locale === "zh-CN" || parsed.locale === "en-US"
          ? parsed.locale
          : fallback.locale,
      theme:
        parsed.theme === "dark" || parsed.theme === "light"
          ? parsed.theme
          : fallback.theme,
    };
  } catch {
    return fallback;
  }
}

function detectLocale(): AppLocale {
  const languages = navigator.languages ?? [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith("zh"))
    ? "zh-CN"
    : "en-US";
}

function detectTheme(): AppTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
