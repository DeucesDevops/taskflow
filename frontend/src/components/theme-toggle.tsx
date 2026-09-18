"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event: MediaQueryListEvent) => {
      if (localStorage.getItem("taskflow-theme")) return;
      const nextTheme: Theme = event.matches ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };
    preference.addEventListener("change", followSystem);
    return () => preference.removeEventListener("change", followSystem);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try { localStorage.setItem("taskflow-theme", nextTheme); } catch { /* The theme still applies for this page. */ }
    setTheme(nextTheme);
  }

  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return <button
    type="button"
    className={`theme-toggle ${className}`.trim()}
    aria-label={label}
    aria-pressed={dark}
    title={label}
    onClick={toggleTheme}
  >
    <Icon name={dark ? "sun" : "moon"} size={17} />
    <span>{dark ? "Light" : "Dark"}</span>
  </button>;
}
