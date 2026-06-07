import type { Monaco } from "@monaco-editor/react";

export const SQL_THEMES = [
  { value: "vs-dark", label: "VS Dark", isDark: true },
  { value: "vs", label: "VS Light", isDark: false },
  { value: "cobalt", label: "Cobalt (SQL Dark)", isDark: true },
  { value: "monokai", label: "Monokai (Vibrant Dark)", isDark: true },
  { value: "solarized-dark", label: "Solarized Dark", isDark: true },
  { value: "github-light", label: "Github Light", isDark: false },
];

export function defineSqlThemes(monaco: Monaco) {
  // Cobalt Theme definition
  monaco.editor.defineTheme("cobalt", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "FF9D00", fontStyle: "bold" },
      { token: "string", foreground: "3AD900" },
      { token: "number", foreground: "FF628C" },
      { token: "comment", foreground: "0088FF", fontStyle: "italic" },
      { token: "type", foreground: "80ffbb" },
      { token: "operator", foreground: "FF9D00" },
      { token: "predefined", foreground: "9EFFFF", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#002240",
      "editor.foreground": "#FFFFFF",
      "editor.lineHighlightBackground": "#00000033",
      "editorCursor.foreground": "#F8F8F0",
      "editor.selectionBackground": "#B3653988",
    },
  });

  // Monokai Theme definition
  monaco.editor.defineTheme("monokai", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "F92672", fontStyle: "bold" },
      { token: "string", foreground: "E6DB74" },
      { token: "number", foreground: "AE81FF" },
      { token: "comment", foreground: "75715E", fontStyle: "italic" },
      { token: "type", foreground: "66D9EF" },
      { token: "operator", foreground: "F92672" },
      { token: "predefined", foreground: "66D9EF", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#272822",
      "editor.foreground": "#F8F8F2",
      "editor.lineHighlightBackground": "#3E3D32",
      "editorCursor.foreground": "#F8F8F0",
      "editor.selectionBackground": "#49483E",
    },
  });

  // Solarized Dark Theme definition
  monaco.editor.defineTheme("solarized-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "859900", fontStyle: "bold" },
      { token: "string", foreground: "2AA198" },
      { token: "number", foreground: "D33682" },
      { token: "comment", foreground: "586E75", fontStyle: "italic" },
      { token: "type", foreground: "268BD2" },
      { token: "operator", foreground: "93A1A1" },
      { token: "predefined", foreground: "268BD2", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#002B36",
      "editor.foreground": "#839496",
      "editor.lineHighlightBackground": "#073642",
      "editorCursor.foreground": "#839496",
      "editor.selectionBackground": "#073642",
    },
  });

  // Github Light Theme definition
  monaco.editor.defineTheme("github-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "D73A49", fontStyle: "bold" },
      { token: "string", foreground: "032F62" },
      { token: "number", foreground: "005CC5" },
      { token: "comment", foreground: "6A737D", fontStyle: "italic" },
      { token: "type", foreground: "6F42C1" },
      { token: "operator", foreground: "D73A49" },
      { token: "predefined", foreground: "6F42C1", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#F6F8FA",
      "editor.foreground": "#24292E",
      "editor.lineHighlightBackground": "#F1F8FF",
      "editorCursor.foreground": "#24292E",
      "editor.selectionBackground": "#0366D625",
    },
  });
}
