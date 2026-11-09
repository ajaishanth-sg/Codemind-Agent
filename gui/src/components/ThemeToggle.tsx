import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { ToolTip } from "./gui/Tooltip";
import HoverItem from "./mainInput/InputToolbar/HoverItem";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("continue-theme-preference");
    if (saved === "light") return false;
    if (saved === "dark") return true;
    return true; // Default to dark mode
  });

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.remove("dark-theme", "light-theme", "vscode-dark", "vscode-light");
    document.body.classList.add(isDark ? "dark-theme" : "light-theme", isDark ? "vscode-dark" : "vscode-light");
    localStorage.setItem("continue-theme-preference", theme);

    const themeVars = isDark
      ? {
          "--vscode-editor-background": "#18181b",
          "--vscode-sideBar-background": "#121215",
          "--vscode-panel-background": "#18181b",
          "--vscode-editor-foreground": "#f1f5f9",
          "--vscode-sideBar-foreground": "#cbd5e1",
          "--vscode-descriptionForeground": "#94a3b8",
          "--vscode-input-background": "#27272a",
          "--vscode-input-foreground": "#f8fafc",
          "--vscode-input-border": "#3f3f46",
          "--vscode-commandCenter-background": "#202023",
          "--vscode-list-hoverBackground": "#27272a",
          "--vscode-list-activeSelectionBackground": "#3f3f46",
          "--vscode-list-activeSelectionForeground": "#ffffff",
        }
      : {
          "--vscode-editor-background": "#ffffff",
          "--vscode-sideBar-background": "#f8fafc",
          "--vscode-panel-background": "#ffffff",
          "--vscode-editor-foreground": "#0f172a",
          "--vscode-sideBar-foreground": "#0f172a",
          "--vscode-descriptionForeground": "#64748b",
          "--vscode-input-background": "#f1f5f9",
          "--vscode-input-foreground": "#0f172a",
          "--vscode-input-border": "#cbd5e1",
          "--vscode-commandCenter-background": "#f8fafc",
          "--vscode-list-hoverBackground": "#f1f5f9",
          "--vscode-list-activeSelectionBackground": "#e2e8f0",
          "--vscode-list-activeSelectionForeground": "#0f172a",
        };

    for (const [key, value] of Object.entries(themeVars)) {
      document.body.style.setProperty(key, value, "important");
      document.documentElement.style.setProperty(key, value, "important");
    }
  }, [isDark]);

  return (
    <ToolTip place="top" content={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
      <HoverItem
        className="cursor-pointer p-1 transition-colors"
        onClick={() => setIsDark((prev) => !prev)}
      >
        {isDark ? (
          <SunIcon className="h-3.5 w-3.5 text-yellow-400 hover:text-yellow-300 transition-colors" />
        ) : (
          <MoonIcon className="h-3.5 w-3.5 text-slate-700 hover:text-slate-900 transition-colors" />
        )}
      </HoverItem>
    </ToolTip>
  );
}
