// All vscode variables https://gist.github.com/estruyf/ba49203e1a7d6868e9320a4ea480c27a
// Examples for vscode https://github.com/githubocto/tailwind-vscode/blob/main/index.js

// Codemind Spider-Man Red Theme (White Background)
export const THEME_COLORS = {
  background: {
    vars: [
      "--vscode-sideBar-background",
      "--vscode-editor-background",
      "--vscode-panel-background",
    ],
    default: "#ffffff",
  },
  foreground: {
    vars: [
      "--vscode-sideBar-foreground",
      "--vscode-editor-foreground",
      "--vscode-panel-foreground",
    ],
    default: "#0f172a",
  },
  "editor-background": {
    vars: ["--vscode-editor-background"],
    default: "#ffffff",
  },
  "editor-foreground": {
    vars: ["--vscode-editor-foreground"],
    default: "#0f172a",
  },
  "primary-background": {
    vars: ["--vscode-button-background"],
    default: "#e62429",
  },
  "primary-foreground": {
    vars: ["--vscode-button-foreground"],
    default: "#ffffff",
  },
  "primary-hover": {
    vars: ["--vscode-button-hoverBackground"],
    default: "#d11a1f",
  },
  "secondary-background": {
    vars: ["--vscode-button-secondaryBackground"],
    default: "#fef2f2",
  },
  "secondary-foreground": {
    vars: ["--vscode-button-secondaryForeground"],
    default: "#b91c1c",
  },
  "secondary-hover": {
    vars: ["--vscode-button-secondaryHoverBackground"],
    default: "#fee2e2",
  },
  border: {
    vars: ["--vscode-sideBar-border", "--vscode-panel-border"],
    default: "#fee2e2",
  },
  "border-focus": {
    vars: ["--vscode-focusBorder"],
    default: "#e62429",
  },
  // Command styles are used for tip-tap editor
  "command-background": {
    vars: ["--vscode-commandCenter-background"],
    default: "#f8fafc",
  },
  "command-foreground": {
    vars: ["--vscode-commandCenter-foreground"],
    default: "#0f172a",
  },
  "command-border": {
    vars: ["--vscode-commandCenter-inactiveBorder"],
    default: "#fca5a5",
  },
  "command-border-focus": {
    vars: ["--vscode-commandCenter-activeBorder"],
    default: "#e62429",
  },
  description: {
    vars: ["--vscode-descriptionForeground"],
    default: "#64748b",
  },
  "description-muted": {
    vars: ["--vscode-list-deemphasizedForeground"],
    default: "#94a3b8",
  },
  "input-background": {
    vars: ["--vscode-input-background"],
    default: "#ffffff",
  },
  "input-foreground": {
    vars: ["--vscode-input-foreground"],
    default: "#0f172a",
  },
  "input-border": {
    vars: [
      "--vscode-input-border",
      "--vscode-commandCenter-inactiveBorder",
      "vscode-border",
    ],
    default: "#fca5a5",
  },
  "input-placeholder": {
    vars: ["--vscode-input-placeholderForeground"],
    default: "#94a3b8",
  },
  "table-oddRow": {
    vars: ["--vscode-tree-tableOddRowsBackground"],
    default: "#fef2f2",
  },
  "badge-background": {
    vars: ["--vscode-badge-background"],
    default: "#e62429",
  },
  "badge-foreground": {
    vars: ["--vscode-badge-foreground"],
    default: "#ffffff",
  },
  info: {
    vars: [
      "--vscode-charts-blue",
      "--vscode-notebookStatusRunningIcon-foreground",
    ],
    default: "#e62429",
  },
  success: {
    vars: [
      "--vscode-notebookStatusSuccessIcon-foreground",
      "--vscode-testing-iconPassed",
      "--vscode-gitDecoration-addedResourceForeground",
      "--vscode-charts-green",
    ],
    default: "#107c10",
  },
  warning: {
    vars: [
      "--vscode-editorWarning-foreground",
      "--vscode-list-warningForeground",
    ],
    default: "#ff8c00",
  },
  error: {
    vars: ["--vscode-editorError-foreground", "--vscode-list-errorForeground"],
    default: "#e62429",
  },
  link: {
    vars: ["--vscode-textLink-foreground"],
    default: "#e62429",
  },
  terminal: {
    vars: ["--vscode-terminal-ansiGreen"],
    default: "#0dbc79",
  },
  textCodeBlockBackground: {
    vars: ["--vscode-textCodeBlock-background"],
    default: "#f8fafc",
  },
  accent: {
    vars: ["--vscode-tab-activeBorderTop", "--vscode-focusBorder"],
    default: "#e62429",
  },
  "find-match": {
    vars: ["--vscode-editor-findMatchBackground"],
    default: "rgba(230, 36, 41, 0.2)",
  },
  "find-match-selected": {
    vars: ["--vscode-editor-findMatchHighlightBackground"],
    default: "rgba(255, 140, 0, 0.3)",
  },
  "list-hover": {
    vars: ["--vscode-list-hoverBackground"],
    default: "#fef2f2",
  },
  "list-active": {
    vars: ["--vscode-list-activeSelectionBackground"],
    default: "#fee2e2",
  },
  "list-active-foreground": {
    vars: ["--vscode-list-activeSelectionForeground"],
    default: "#b91c1c",
  },
};

export const THEME_CSS_VARS = Object.values(THEME_COLORS)
  .map((value) => value.vars)
  .flat();

export const THEME_CSS_VAR_DEFAULTS = Object.entries(THEME_COLORS).reduce(
  (acc, [_, value]) => {
    value.vars.forEach((varName) => {
      acc[varName] = value.default;
    });
    return acc;
  },
  {} as Record<string, string>,
);

export const THEME_DEFAULTS = Object.entries(THEME_COLORS).reduce(
  (acc, [key, value]) => {
    acc[key] = value.default;
    return acc;
  },
  {} as Record<string, string>,
);

// Generates recursive CSS variable fallback for a given color name
// e.g. var(--vscode-button-background, var(--vscode-button-foreground, #ffffff))
export const getRecursiveVar = (vars: string[], defaultColor: string) => {
  return [...vars].reverse().reduce((curr, varName) => {
    return `var(${varName}, ${curr})`;
  }, defaultColor);
};

export const varWithFallback = (colorName: keyof typeof THEME_COLORS) => {
  const themeVals = THEME_COLORS[colorName];
  if (!themeVals) {
    throw new Error(`Invalid theme color name ${colorName}`);
  }
  return getRecursiveVar(themeVals.vars, themeVals.default);
};

export const setDocumentStylesFromTheme = (
  theme: Record<string, string | undefined | null>,
) => {
  // Check for extraneous theme items
  Object.entries(theme).forEach(([colorName, value]) => {
    const themeVals = THEME_COLORS[colorName as keyof typeof THEME_COLORS];
    if (!themeVals) {
      console.warn(
        `Receieved theme color ${colorName} which is not used by the theme`,
      );
      return;
    }
  });

  // Write theme values to document
  const missingColors: string[] = [];
  Object.entries(THEME_COLORS).forEach(([colorName, settings]) => {
    let colorVal = settings.default;
    const newColor = theme[colorName];
    if (newColor) {
      colorVal = newColor;
      // Remove alpha channel from all hex colors (seems to cause bad colors)
      if (newColor.startsWith("#") && newColor.length > 7) {
        colorVal = colorVal.slice(0, 7);
      }
    } else {
      missingColors.push(colorName);
      // console.warn(
      //   `Missing theme color: ${colorName}. Falling back to default ${colorVal}`,
      // );
    }

    localStorage.setItem(colorName, colorVal);
    for (const cssVar of settings.vars) {
      document.body.style.setProperty(cssVar, colorVal);
      document.documentElement.style.setProperty(cssVar, colorVal);
    }
  });

  return missingColors;
};

export const setDocumentStylesFromLocalStorage = (checkCache: boolean) => {
  for (const [colorName, themeVals] of Object.entries(THEME_COLORS)) {
    for (const cssVar of themeVals.vars) {
      // Get cached values (for non-vscode IDEs)
      if (checkCache) {
        const cached = localStorage.getItem(colorName);
        if (cached) {
          document.body.style.setProperty(cssVar, cached);
        }
      }
    }
  }
};

export const clearThemeLocalCache = () => {
  for (const colorName of Object.keys(THEME_COLORS)) {
    localStorage.removeItem(colorName);
  }
};
