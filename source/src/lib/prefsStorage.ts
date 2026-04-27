import type { Theme, EditorMode, SidebarTab, FileSort } from '../types'

/**
 * Persistent UI preferences. Anything the user toggles via menus /
 * keyboard shortcuts that they would expect to survive a restart goes
 * here (matching Obsidian's expectation that the workspace remembers
 * itself between sessions). Configurable settings (file paths, auto-save
 * etc.) are kept separately in `settingsStorage.ts`; recent files are
 * in `useAppStore`. Both keep their existing localStorage keys to avoid
 * a migration.
 *
 * Transient session state (current `doc`, `activeFile`, dialog open/close,
 * selection paths, find panel state, etc.) is intentionally NOT persisted.
 */
const PREFS_KEY = 'shymd-prefs-v1'

export interface AppPrefs {
  theme: Theme
  sidebarVisible: boolean
  sidebarWidth: number
  activeTab: SidebarTab
  editorMode: EditorMode
  focusMode: boolean
  typewriterMode: boolean
  zoom: number
  fileSort: FileSort
}

export const defaultPrefs: AppPrefs = {
  theme: 'light',
  sidebarVisible: true,
  sidebarWidth: 240,
  activeTab: 'files',
  editorMode: 'wysiwyg',
  focusMode: false,
  typewriterMode: false,
  zoom: 100,
  fileSort: 'name',
}

export function loadPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { ...defaultPrefs, ...parsed }
      }
    }
  } catch {
    // ignore — corrupt/quota/private mode
  }
  return { ...defaultPrefs }
}

export function savePrefs(prefs: AppPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}
