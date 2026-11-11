"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark";
const themeEvent = "noor:theme-change";
const systemQuery = "(prefers-color-scheme: dark)";
let themeTransitionTimer: number | null = null;

function triggerSmoothThemeTransition() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  if (themeTransitionTimer !== null) {
    window.clearTimeout(themeTransitionTimer);
  }
  themeTransitionTimer = window.setTimeout(() => {
    root.classList.remove("theme-transitioning");
    themeTransitionTimer = null;
  }, 620);
}

function applyTheme(preference: Theme | null) {
  const theme = preference ?? (window.matchMedia(systemQuery).matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference ?? "system";
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#171513" : "#ffffff";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(systemQuery);
  const onSystemChange = () => {
    if (document.documentElement.dataset.themePreference === "system") {
      applyTheme(null);
      onChange();
    }
  };
  const onStorageChange = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(event.newValue === "light" || event.newValue === "dark" ? event.newValue : null);
      onChange();
    }
  };
  window.addEventListener(themeEvent, onChange);
  window.addEventListener("storage", onStorageChange);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(themeEvent, onChange);
    window.removeEventListener("storage", onStorageChange);
    media.removeEventListener("change", onSystemChange);
  };
}

const getSnapshot = () => document.documentElement.dataset.theme === "dark";
const getServerSnapshot = () => false;

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const shouldReduceMotion = useReducedMotion();

  function toggleTheme() {
    const theme = getSnapshot() ? "light" : "dark";
    triggerSmoothThemeTransition();
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The switch still works for this visit when browser storage is blocked.
    }
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <LazyMotion features={domAnimation}>
      <button
        type="button"
        className={`${variant === "menu" ? "menu-theme-toggle" : "icon-button"} theme-toggle`}
        onClick={toggleTheme}
        aria-label="Dark mode"
        aria-pressed={isDark}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <m.span
          key={isDark ? "dark-icon" : "light-icon"}
          className="theme-icon-motion"
          initial={shouldReduceMotion ? false : { rotate: isDark ? -120 : 120, scale: 0.55, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <Moon className="theme-moon" aria-hidden="true" />
          <Sun className="theme-sun" aria-hidden="true" />
        </m.span>
        {variant === "menu" && (
          <>
            <span>Dark mode</span>
            <span className="theme-switch-track" aria-hidden="true">
              <span />
            </span>
          </>
        )}
      </button>
    </LazyMotion>
  );
}

