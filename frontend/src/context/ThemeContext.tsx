import { App, ConfigProvider, theme } from "antd";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "athql-theme";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function buildAntTheme(mode: ThemeMode) {
  const isDark = mode === "dark";

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: isDark ? "#3b82f6" : "#2563eb",
      colorPrimaryHover: isDark ? "#60a5fa" : "#1d4ed8",
      colorPrimaryActive: isDark ? "#2563eb" : "#1e40af",
      borderRadius: 4,
      borderRadiusSM: 4,
      borderRadiusLG: 4,
      fontSize: 13,
      fontSizeSM: 12,
      controlHeight: 32,
      controlHeightSM: 28,
      lineWidthFocus: 1,
      controlOutlineWidth: 2,
      controlOutline: isDark ? "rgba(59, 130, 246, 0.18)" : "rgba(37, 99, 235, 0.14)",
      colorBorder: isDark ? "#2a3441" : "#d8dee6",
      colorBorderSecondary: isDark ? "#232d3b" : "#e5e9ef",
      colorBgContainer: isDark ? "#151b24" : "#ffffff",
      colorBgElevated: isDark ? "#1a2230" : "#ffffff",
      colorText: isDark ? "#e2e8f0" : "#1f2937",
      colorTextSecondary: isDark ? "#94a3b8" : "#64748b",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    components: {
      Button: {
        controlHeight: 32,
        controlHeightSM: 28,
        paddingInline: 12,
        paddingInlineSM: 10,
        fontWeight: 500,
        primaryShadow: "none",
        defaultShadow: "none",
        defaultBg: isDark ? "#1a2230" : "#ffffff",
        defaultBorderColor: isDark ? "#2a3441" : "#d8dee6",
        defaultColor: isDark ? "#cbd5e1" : "#334155",
        defaultHoverBg: isDark ? "#243041" : "#f8fafc",
        defaultHoverBorderColor: isDark ? "#334155" : "#cbd5e1",
        defaultHoverColor: isDark ? "#f1f5f9" : "#0f172a",
        defaultActiveBg: isDark ? "#1e2733" : "#f1f5f9",
        defaultActiveBorderColor: isDark ? "#3b4a5c" : "#94a3b8",
        defaultActiveColor: isDark ? "#f8fafc" : "#0f172a",
        colorTextDisabled: isDark ? "#475569" : "#94a3b8",
        colorBgContainerDisabled: isDark ? "#151b24" : "#f8fafc",
        colorBorderDisabled: isDark ? "#232d3b" : "#e5e9ef",
      },
      Select: {
        controlHeightSM: 28,
        optionSelectedBg: isDark ? "#243041" : "#eef2f6",
        optionActiveBg: isDark ? "#1e2733" : "#f1f5f9",
        optionSelectedColor: isDark ? "#f1f5f9" : "#0f172a",
        selectorBg: isDark ? "#151b24" : "#ffffff",
      },
      Input: {
        controlHeightSM: 28,
        activeShadow: isDark ? "0 0 0 2px rgba(59, 130, 246, 0.18)" : "0 0 0 2px rgba(37, 99, 235, 0.14)",
      },
      InputNumber: {
        controlHeightSM: 28,
        activeShadow: isDark ? "0 0 0 2px rgba(59, 130, 246, 0.18)" : "0 0 0 2px rgba(37, 99, 235, 0.14)",
      },
      Segmented: {
        trackBg: isDark ? "#111820" : "#f1f5f9",
        itemSelectedBg: isDark ? "#243041" : "#ffffff",
        itemHoverBg: isDark ? "#1e2733" : "#f8fafc",
      },
      Tabs: {
        cardBg: isDark ? "#1a2230" : "#f3f5f7",
      },
      Alert: {
        colorInfoBg: isDark ? "#1a2744" : "#eff6ff",
        colorInfoBorder: isDark ? "#1e3a5f" : "#bfdbfe",
        colorSuccessBg: isDark ? "#14291f" : "#f0fdf4",
        colorSuccessBorder: isDark ? "#166534" : "#bbf7d0",
        colorWarningBg: isDark ? "#2a2210" : "#fffbeb",
        colorWarningBorder: isDark ? "#854d0e" : "#fde68a",
        colorErrorBg: isDark ? "#2a1515" : "#fef2f2",
        colorErrorBorder: isDark ? "#991b1b" : "#fecaca",
      },
      Message: {
        contentBg: isDark ? "#1a2230" : "#ffffff",
        contentPadding: "10px 14px",
      },
      Notification: {
        colorBgElevated: isDark ? "#1a2230" : "#ffffff",
      },
    },
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = () => setMode((current) => (current === "light" ? "dark" : "light"));

  const antTheme = useMemo(() => buildAntTheme(mode), [mode]);

  const value = useMemo(
    () => ({ mode, isDark: mode === "dark", setMode, toggle }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antTheme}>
        <App className="athql-app">{children}</App>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
