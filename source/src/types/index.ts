export type EditorMode = 'wysiwyg' | 'source' | 'reading'

export type Theme = 'light' | 'dark' | 'morandi' | 'eye-care' | 'system'

export interface AppSettings {
  fileStoragePath: string
  downloadPath: string
  cachePath: string
  autoSave: boolean
  autoSaveDelay: number
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
  activeFile: string
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
  setActiveFile: (name: string, content: string) => void
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
  updateFileContent: (name: string, content: string) => void

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

  recentFiles: string[]
  addRecentFile: (name: string) => void
  removeRecentFile: (name: string) => void
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

export type FindMode = 'find' | 'replace'

export type HelpModalKind = 'shortcuts' | 'syntax' | 'about' | 'changelog' | null
