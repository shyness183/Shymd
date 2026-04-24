export type EditorMode = 'wysiwyg' | 'source' | 'reading'

export type Theme = 'light' | 'dark' | 'morandi' | 'eye-care' | 'system'

export interface AppSettings {
  fileStoragePath: string
  downloadPath: string
  cachePath: string
  autoSave: boolean
  autoSaveDelay: number
  /** Browser spellcheck on the editor surface. */
  spellcheck: boolean
  /**
   * Where to copy images picked via Insert-Image. If blank, Shymd uses
   * the picked file's original location. Distinct from `cachePath` so
   * future features (plugin cache, thumbnails) can reuse cachePath
   * without breaking image references in existing notes.
   */
  imageStoragePath: string
}

export interface FileNode {
  name: string
  type: 'file' | 'folder'
  children?: FileNode[]
  content?: string
}

export interface AppState {
  theme: Theme
  sidebarVisible: boolean
  sidebarWidth: number
  activeTab: 'files' | 'outline'
  editorMode: EditorMode
  doc: string
  /** Basename of the active file, for display in status bar / title bar.
   *  '' when nothing is open. NOTE: may be ambiguous when two files share
   *  a name; use `activeFilePath` for disk/tree ops. */
  activeFile: string
  /** Tree path of the active file relative to the workspace root.
   *  Empty array means: no file open, OR the file lives outside the
   *  workspace (see `activeAbsolutePath`). This is the SOURCE OF TRUTH
   *  for everything that walks the tree (setDoc, rename, delete, move). */
  activeFilePath: string[]
  /** Absolute disk path of the active file. Used for all disk writes so
   *  that files opened via "Set as default app" / "Open File…" outside
   *  the workspace still save to the right place. Null for browser mode
   *  or purely in-memory files. */
  activeAbsolutePath: string | null
  focusMode: boolean
  typewriterMode: boolean
  zoom: number
  files: FileNode[]

  toggleTheme: () => void
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
  setSidebarWidth: (w: number) => void
  setActiveTab: (tab: 'files' | 'outline') => void
  setEditorMode: (mode: EditorMode) => void
  setDoc: (content: string) => void
  /** Activate a file that's purely in-memory (e.g. the welcome doc or a
   *  browser-mode upload). Prefer `openFileByPath` for workspace files. */
  setActiveFile: (name: string, content: string, path?: string[], absolutePath?: string | null) => void
  /** Open a file by its full path in the tree. Lazy-reads from disk when
   *  the node's content isn't cached. Required because `readDirTree` scans
   *  directories without reading file bodies. */
  openFileByPath: (path: string[]) => Promise<void>
  /** Open any file by absolute disk path (used by "Set as default app"
   *  and "Open File…" dialog). If the path is inside the workspace,
   *  delegates to `openFileByPath`; otherwise opens standalone. */
  openFileByAbsolutePath: (absolutePath: string) => Promise<void>
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void

  createFile: (parentPath: string[], name: string) => void
  createFolder: (parentPath: string[], name: string) => void
  /** Delete a node from the tree. By default also removes it on disk
   *  (Tauri). Pass `{ keepOnDisk: true }` to only remove from the sidebar
   *  (e.g. the user answered "keep local files" in the confirm dialog). */
  deleteNode: (path: string[], options?: { keepOnDisk?: boolean }) => void
  renameNode: (path: string[], newName: string) => void
  moveNode: (sourcePath: string[], destFolderPath: string[]) => void

  settings: AppSettings
  settingsOpen: boolean
  setSettings: (partial: Partial<AppSettings>) => void
  setSettingsOpen: (open: boolean) => void

  helpModal: HelpModalKind
  setHelpModal: (kind: HelpModalKind) => void

  findOpen: boolean
  findMode: FindMode
  setFindOpen: (open: boolean, mode?: FindMode) => void

  tablePickerOpen: boolean
  setTablePickerOpen: (open: boolean) => void

  /** Most-recently opened files. Each entry has a display name and the
   *  path info needed to re-open it unambiguously. */
  recentFiles: RecentFileEntry[]
  addRecentFile: (entry: RecentFileEntry) => void
  removeRecentFile: (entry: RecentFileEntry) => void
  clearRecentFiles: () => void

  editingPath: string[] | null
  setEditingPath: (path: string[] | null) => void

  /** Last known on-disk content of the active file (for dirty-state tracking). */
  lastSavedDoc: string
  /** Mark the current doc as saved (updates lastSavedDoc = doc). */
  markSaved: () => void

  /** Sidebar multi-select: paths of currently selected file nodes. */
  selectedPaths: string[][]
  setSelectedPaths: (paths: string[][]) => void
  toggleSelectPath: (path: string[], additive: boolean) => void
  clearSelectedPaths: () => void
  /** Remove all selected nodes from the sidebar. By default keeps files on
   *  disk; pass `{ alsoDeleteOnDisk: true }` to permanently delete them too. */
  deleteSelectedFromTree: (options?: { alsoDeleteOnDisk?: boolean }) => void
}

export interface RecentFileEntry {
  /** Display name (basename). */
  name: string
  /** Tree path (empty when the file lives outside the workspace). */
  path: string[]
  /** Absolute disk path. Always populated in Tauri so we can reopen
   *  files regardless of whether the workspace root has changed. */
  absolutePath?: string
}

export type FindMode = 'find' | 'replace'

export type HelpModalKind = 'shortcuts' | 'syntax' | 'about' | 'changelog' | null
