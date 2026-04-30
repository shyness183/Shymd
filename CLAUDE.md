# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Shymd is a WYSIWYG Markdown desktop editor built with Tauri 2.x. The entire application source lives in `source/`.

## Build / Dev Commands

```bash
cd source

npm run dev              # Vite dev server (browser-only, no filesystem)
npm run tauri dev        # Full desktop app (Tauri + Vite)
npm run build            # tsc -b && vite build
npm run tauri build      # Production desktop build
npm run lint             # ESLint
npm run preview          # vite preview
```

## Project Structure

```
source/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               # UI components, one folder each
│   │   ├── Editor/               # Three editor modes + FloatingToolbar
│   │   │   ├── WysiwygEditor.tsx # contentEditable WYSIWYG mode
│   │   │   ├── SourceEditor.tsx  # CodeMirror 6 source mode
│   │   │   ├── ReadingView.tsx   # Read-only rendered view
│   │   │   ├── FloatingToolbar.tsx
│   │   │   └── cmTheme.ts       # CM6 theme colors
│   │   ├── Sidebar/             # File tree + outline + search
│   │   ├── TopBar/              # Title bar, toolbar, window controls
│   │   ├── MenuBar/             # Dropdown menus
│   │   ├── Settings/            # Preferences modal
│   │   ├── FindReplace/         # Find/replace panel
│   │   ├── PopoverMenu/         # Format popover
│   │   ├── SlashMenu/           # "/" command menu
│   │   ├── TablePicker/         # Grid table inserter
│   │   ├── LinkDialog/          # Hyperlink dialog
│   │   ├── MathDialog/          # Math formula dialog
│   │   └── Toast/               # Toast notifications
│   ├── hooks/                   # Custom React hooks
│   │   ├── useKeyboard.ts       # Global keyboard shortcuts
│   │   ├── useAutosave.ts       # Debounced disk write
│   │   ├── useTheme.ts          # Theme CSS variable application
│   │   ├── useTypewriter.ts     # Typewriter mode scroll
│   │   ├── useWindowState.ts    # Persist window position/size
│   │   ├── useLocale.tsx        # i18n context provider
│   │   ├── useInitialLoad.ts    # Startup file loading
│   │   └── useLaunchFile.ts     # OS file association handler
│   ├── lib/                     # Core utilities (no React dependency)
│   │   ├── markdown.ts          # markdown-it config (KaTeX, Mermaid, TOC, etc.)
│   │   ├── filesystem.ts        # Tauri FS abstraction layer
│   │   ├── fileTreeUtils.ts     # Immutable file tree operations
│   │   ├── editorCommands.ts    # CodeMirror command wrappers
│   │   ├── htmlEditorCommands.ts# contentEditable execCommand wrappers
│   │   └── fileActions.ts       # Save/open/new file actions
│   ├── stores/
│   │   └── useAppStore.ts       # Single Zustand store for all state
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── styles/                  # CSS variables, reset, typography
│   └── locales/                 # en-US.json, zh-CN.json
├── src-tauri/                   # Tauri Rust backend
│   └── src/
│       ├── main.rs              # Entry point
│       └── lib.rs               # Tauri commands, plugins, launch setup
└── vite.config.ts
```

## Architecture Notes

### Three Editor Modes
- **WYSIWYG** (`WysiwygEditor.tsx`): Uses `contentEditable` div. Renders markdown → HTML via markdown-it, then converts HTML back → markdown via Turndown on every edit (400ms debounce). Auto-formats typed markdown syntax (e.g., `# ` → `<h1>`).
- **Source** (`SourceEditor.tsx`): CodeMirror 6 with markdown language + extensions. Updates zustand doc on every change.
- **Reading** (`ReadingView.tsx`): Static HTML render, no editing.

### State Management
- Single Zustand store (`useAppStore`) holds all app state: doc content, active file, sidebar, settings, recent files, etc.
- UI prefs (theme, sidebar width, zoom, mode) auto-persist to localStorage.
- Settings persist to localStorage via `loadSettings`/`saveSettings`.

### Filesystem
- `filesystem.ts` abstracts Tauri plugin-fs calls behind `isTauri()` checks. All file operations silently no-op in browser mode.
- `useAutosave` hook writes to disk on doc change (debounced, default 1s).
- File tree operations (`fileTreeUtils.ts`) use immutable clone-then-mutate pattern for zustand updates.

### Markdown Pipeline
- **Rendering**: `markdown-it` → KaTeX (math), Mermaid (diagrams, post-render), highlight.js (code), markdown-it plugins (footnote, task-lists, mark, front-matter, TOC).
- **Serialization**: TurndownService with custom rules for strikethrough, underline, highlight, KaTeX, tables, front-matter, Mermaid, images.
- `injectTOC()` finds `[TOC]` placeholders and generates heading nav.
- `resolveRelativeAssets()` rewrites relative image `src` to Tauri asset:// URLs.

### Keyboard Shortcuts
- All handled in `useKeyboard.ts`. Dispatches to `editorCommands.ts` (CM6) or `htmlEditorCommands.ts` (contentEditable) depending on active mode.
- `htmlEditorCommands.ts` uses `execCommand` (deprecated but pragmatic for contentEditable).

### Tauri Backend
- `lib.rs`: Registers `move_to_trash` and `get_launch_file` commands, sets up plugins (fs, dialog, opener, single-instance, logging).
- Single-instance handling forwards secondary instance file opens to the running window.
- `md_path_from_args` parses argv for `.md` file paths (OS file association).

## Key Patterns

- **CSS**: CSS Modules per-component + global CSS custom properties in `styles/variables.css`. Theme switching swaps `data-theme` attribute on `<html>`.
- **i18n**: `useLocale()` context provides `t()` function. Keys stored in `locales/*.json`.
- **Dialog/Modal pattern**: Each dialog is its own component rendered in `App.tsx`, controlled by zustand boolean (e.g., `settingsOpen`, `findOpen`).
- **New components**: One folder per component with `.tsx` + optional `.module.css`.
