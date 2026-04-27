import { create } from 'zustand'
import type { AppState, RecentFileEntry } from '../types'
import { defaultDoc } from './defaultDoc'
import { sampleFiles } from './sampleFiles'
import {
  insertNode,
  removeNode,
  renameNodeInTree,
  updateContentByPath,
  uniqueName,
  moveNode as moveNodeInTree,
  findNodeByPath,
  pathIsPrefix,
} from '../lib/fileTreeUtils'
import { loadSettings, saveSettings } from '../lib/settingsStorage'
import { loadPrefs, savePrefs } from '../lib/prefsStorage'
import { isTauri, writeFileText, createDir, moveToTrash, renamePath, readFileText } from '../lib/filesystem'
import { showToast } from '../components/Toast/Toast'

// ── Recent-files migration ─────────────────────────────────────────
// Old schema was `string[]` (bare filenames). Convert on load so returning
// users don't lose their history, but new entries carry full path info.
function loadRecentFiles(): RecentFileEntry[] {
  try {
    const raw = localStorage.getItem('shymd-recent')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item): RecentFileEntry | null => {
        if (typeof item === 'string') {
          // Legacy: only have the name. Best-effort conversion — path
          // guess is wrong if the file was nested, but the migration
          // just lets clicking still work via findNodeByPath(name lookup).
          return { name: item, path: [item] }
        }
        if (item && typeof item.name === 'string' && Array.isArray(item.path)) {
          return {
            name: item.name,
            path: item.path,
            absolutePath: typeof item.absolutePath === 'string' ? item.absolutePath : undefined,
          }
        }
        return null
      })
      .filter((e): e is RecentFileEntry => e !== null)
  } catch {
    return []
  }
}
function saveRecentFiles(list: RecentFileEntry[]) {
  try {
    localStorage.setItem('shymd-recent', JSON.stringify(list))
  } catch {
    // quota / private mode — ignore
  }
}

// Start with a fresh, empty editor on every launch (like Notepad).
// Past files live in "Recent Files" history, and — in Tauri — on disk.
// First-run users still see the sample welcome file to help onboarding.
const isFirstRun = typeof localStorage !== 'undefined' && !localStorage.getItem('shymd-launched')
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('shymd-launched', '1')
}
const initialFiles = isFirstRun ? sampleFiles : []
const initialActiveFile = isFirstRun ? '欢迎使用 Shymd.md' : ''
const initialActivePath: string[] = isFirstRun ? ['欢迎使用 Shymd.md'] : []
const initialDoc = isFirstRun ? defaultDoc : ''

// Monotonically-increasing counter: each file-open call takes a snapshot;
// if the counter has moved on by the time the async read finishes, the
// result is stale and should be discarded.
let _openFileSeq = 0

/** Build an absolute disk path from the workspace root + tree path. */
function absFromTreePath(root: string, path: string[]): string {
  const trimmed = root.replace(/[\\/]+$/, '')
  return [trimmed, ...path].join('/')
}

/** Normalise mixed-slash absolute path for prefix comparison. */
function normSlash(s: string): string {
  return s.replace(/\\/g, '/').replace(/\/+$/, '')
}

// Hydrate persistent UI prefs from localStorage. Without this, every
// launch resets theme / sidebar / mode / zoom etc. (the bug user reported).
const _prefs = loadPrefs()

export const useAppStore = create<AppState>((set, get) => ({
  theme: _prefs.theme,
  sidebarVisible: _prefs.sidebarVisible,
  sidebarWidth: _prefs.sidebarWidth,
  activeTab: _prefs.activeTab,
  editorMode: _prefs.editorMode,
  doc: initialDoc,
  activeFile: initialActiveFile,
  activeFilePath: initialActivePath,
  activeAbsolutePath: null,
  focusMode: _prefs.focusMode,
  typewriterMode: _prefs.typewriterMode,
  zoom: _prefs.zoom,
  fileSort: _prefs.fileSort,
  setFileSort: (s) => set({ fileSort: s }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  files: initialFiles,

  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

  setTheme: (t) => set({ theme: t }),

  toggleSidebar: () =>
    set((s) => ({ sidebarVisible: !s.sidebarVisible })),

  setSidebarWidth: (w) =>
    set({ sidebarWidth: Math.min(400, Math.max(180, w)) }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  /** Replace the current doc. Mirrors into the tree node at
   *  `activeFilePath` (path-based, not name-based, so files with duplicate
   *  names don't cross-contaminate). */
  setDoc: (content) => {
    const { activeFilePath, files } = get()
    if (activeFilePath.length > 0) {
      set({ doc: content, files: updateContentByPath(files, activeFilePath, content) })
    } else {
      set({ doc: content })
    }
  },

  setActiveFile: (name, content, path, absolutePath) => {
    set({
      activeFile: name,
      doc: content,
      lastSavedDoc: content,
      activeFilePath: path ?? (name ? [name] : []),
      activeAbsolutePath: absolutePath ?? null,
    })
    if (name) {
      get().addRecentFile({
        name,
        path: path ?? [name],
        absolutePath: absolutePath ?? undefined,
      })
    }
  },

  /**
   * Open a file by its tree path. If the node's content is already cached
   * in-memory (sample files, recently edited), uses it directly; otherwise
   * lazy-reads from disk via `fileStoragePath + path`.
   */
  openFileByPath: async (path) => {
    if (path.length === 0) return
    const seq = ++_openFileSeq
    const { files, settings } = get()
    const node = findNodeByPath(files, path)
    if (!node || node.type !== 'file') return
    const name = path[path.length - 1]
    const abs = settings.fileStoragePath ? absFromTreePath(settings.fileStoragePath, path) : null

    // In-memory cache hit (sample files, edited files)
    if (node.content != null) {
      if (seq !== _openFileSeq) return
      set({
        activeFile: name,
        activeFilePath: path,
        activeAbsolutePath: abs,
        doc: node.content,
        lastSavedDoc: node.content,
      })
      get().addRecentFile({ name, path, absolutePath: abs ?? undefined })
      return
    }

    // Cache miss: read from disk (Tauri only). Browser can't recover.
    if (!isTauri() || !abs) {
      if (seq !== _openFileSeq) return
      set({
        activeFile: name,
        activeFilePath: path,
        activeAbsolutePath: abs,
        doc: '',
        lastSavedDoc: '',
      })
      get().addRecentFile({ name, path, absolutePath: abs ?? undefined })
      return
    }
    try {
      const content = await readFileText(abs)
      if (seq !== _openFileSeq) return
      set({
        activeFile: name,
        activeFilePath: path,
        activeAbsolutePath: abs,
        doc: content,
        lastSavedDoc: content,
        files: updateContentByPath(get().files, path, content),
      })
      get().addRecentFile({ name, path, absolutePath: abs })
    } catch (err) {
      if (seq !== _openFileSeq) return
      console.error('Failed to read file from disk:', abs, err)
      showToast(`无法打开文件：${name}`, 'error')
    }
  },

  /**
   * Open any file by absolute disk path (e.g. double-clicked from Explorer
   * or picked from the Open File dialog). If the file sits inside the
   * current workspace we route through `openFileByPath` so the sidebar
   * highlight works; otherwise we open it standalone.
   */
  openFileByAbsolutePath: async (absolutePath) => {
    if (!isTauri()) return
    const seq = ++_openFileSeq
    const { settings } = get()
    const abs = normSlash(absolutePath)
    const root = settings.fileStoragePath ? normSlash(settings.fileStoragePath) : ''

    // Inside workspace? Open via tree path (openFileByPath manages its own seq).
    if (root && abs.startsWith(root + '/')) {
      const rel = abs.slice(root.length + 1).split('/').filter(Boolean)
      if (rel.length > 0) {
        await get().openFileByPath(rel)
        return
      }
    }

    // External file: read directly; no tree entry.
    try {
      const content = await readFileText(absolutePath)
      if (seq !== _openFileSeq) return
      const name = abs.split('/').pop() || 'untitled.md'
      set({
        activeFile: name,
        activeFilePath: [],
        activeAbsolutePath: absolutePath,
        doc: content,
        lastSavedDoc: content,
      })
      get().addRecentFile({ name, path: [], absolutePath })
    } catch (err) {
      if (seq !== _openFileSeq) return
      console.error('Failed to read external file:', absolutePath, err)
      showToast(`无法打开文件：${absolutePath}`, 'error')
    }
  },

  toggleFocusMode: () =>
    set((s) => ({ focusMode: !s.focusMode })),

  toggleTypewriterMode: () =>
    set((s) => ({ typewriterMode: !s.typewriterMode })),

  zoomIn: () =>
    set((s) => ({ zoom: Math.min(200, s.zoom + 10) })),

  zoomOut: () =>
    set((s) => ({ zoom: Math.max(50, s.zoom - 10) })),

  zoomReset: () => set({ zoom: 100 }),

  createFile: (parentPath, name) => {
    const { files, settings } = get()
    const findSiblings = (tree: typeof files, path: string[]) => {
      let current = tree
      for (const seg of path) {
        const folder = current.find((n) => n.name === seg && n.type === 'folder')
        if (!folder?.children) return current
        current = folder.children
      }
      return current
    }
    const siblings = findSiblings(files, parentPath)
    const finalName = uniqueName(siblings, name)
    const newFiles = insertNode(files, parentPath, {
      name: finalName,
      type: 'file',
      content: '',
    })
    const newPath = [...parentPath, finalName]
    const abs = isTauri() && settings.fileStoragePath
      ? absFromTreePath(settings.fileStoragePath, newPath)
      : null
    set({
      files: newFiles,
      activeFile: finalName,
      activeFilePath: newPath,
      activeAbsolutePath: abs,
      doc: '',
      lastSavedDoc: '',
    })

    // Ensure the parent directory exists before writing — otherwise the
    // write fails silently and the file is in the tree but not on disk.
    if (isTauri() && settings.fileStoragePath) {
      const parentDir = absFromTreePath(settings.fileStoragePath, parentPath)
      ;(async () => {
        try {
          if (parentPath.length > 0) await createDir(parentDir)
          await writeFileText(abs!, '')
        } catch (err) {
          console.error('Failed to create file on disk:', err)
          showToast(`文件创建失败：${finalName}`, 'error')
        }
      })()
    }
  },

  createFolder: (parentPath, name) => {
    const { files, settings } = get()
    const findSiblings = (tree: typeof files, path: string[]) => {
      let current = tree
      for (const seg of path) {
        const folder = current.find((n) => n.name === seg && n.type === 'folder')
        if (!folder?.children) return current
        current = folder.children
      }
      return current
    }
    const siblings = findSiblings(files, parentPath)
    const finalName = uniqueName(siblings, name)
    const newFiles = insertNode(files, parentPath, {
      name: finalName,
      type: 'folder',
      children: [],
    })
    set({ files: newFiles })

    if (isTauri() && settings.fileStoragePath) {
      const fullPath = absFromTreePath(settings.fileStoragePath, [...parentPath, finalName])
      createDir(fullPath).catch((err) => {
        console.error('Failed to create folder on disk:', err)
        showToast(`文件夹创建失败：${finalName}`, 'error')
      })
    }
  },

  deleteNode: (path, options) => {
    const keepOnDisk = options?.keepOnDisk ?? false
    const { files, activeFilePath, settings } = get()

    const node = findNodeByPath(files, path)
    const newFiles = removeNode(files, path)

    // Clear active state only if the deleted path equals or contains the
    // active file (path-based, so duplicate names don't falsely match).
    const isActiveDeleted = pathIsPrefix(path, activeFilePath)
    if (isActiveDeleted) {
      set({
        files: newFiles,
        activeFile: '',
        activeFilePath: [],
        activeAbsolutePath: null,
        doc: '',
        lastSavedDoc: '',
      })
    } else {
      set({ files: newFiles })
    }

    // Mirror to disk if configured AND the caller did not opt out
    if (!keepOnDisk && isTauri() && settings.fileStoragePath && node) {
      const fullPath = absFromTreePath(settings.fileStoragePath, path)
      moveToTrash(fullPath, node.type === 'folder').catch((err) => {
        console.error('Failed to move to trash:', err)
        showToast(`删除失败：${path[path.length - 1]}`, 'error')
      })
    }
  },

  renameNode: (path, newName) => {
    const { files, activeFilePath, settings } = get()

    // Collision check: refuse if sibling with the same name exists.
    const parentPath = path.slice(0, -1)
    const oldName = path[path.length - 1]
    if (oldName !== newName) {
      const parent = parentPath.length === 0
        ? files
        : (findNodeByPath(files, parentPath)?.children ?? [])
      if (parent.some((n) => n.name === newName)) {
        showToast(`该目录下已存在「${newName}」`, 'warn')
        return
      }
    }

    const newFiles = renameNodeInTree(files, path, newName)

    // If the rename touches the active file's path, update active state too.
    let patch: Partial<AppState> = { files: newFiles }
    if (pathIsPrefix(path, activeFilePath)) {
      const newActivePath = [...path.slice(0, -1), newName, ...activeFilePath.slice(path.length)]
      patch = {
        ...patch,
        activeFilePath: newActivePath,
        activeFile: newActivePath[newActivePath.length - 1],
        activeAbsolutePath: settings.fileStoragePath
          ? absFromTreePath(settings.fileStoragePath, newActivePath)
          : null,
      }
    }
    set(patch)

    // Mirror to disk
    if (isTauri() && settings.fileStoragePath) {
      const root = settings.fileStoragePath.replace(/[\\/]+$/, '')
      const oldPath = [root, ...path].join('/')
      const newPath = [root, ...path.slice(0, -1), newName].join('/')
      renamePath(oldPath, newPath).catch((err) => {
        console.error('Failed to rename on disk:', err)
        showToast(`磁盘上重命名失败：${oldName} → ${newName}`, 'error')
      })
    }
  },

  moveNode: (sourcePath, destFolderPath) => {
    const { files, activeFilePath, settings } = get()
    const result = moveNodeInTree(files, sourcePath, destFolderPath)
    if (!result) {
      // Could be: moving into self, moving into a descendant, or no-op.
      showToast('无法移动到该位置', 'warn')
      return
    }

    let patch: Partial<AppState> = { files: result }
    if (pathIsPrefix(sourcePath, activeFilePath)) {
      const moved = sourcePath[sourcePath.length - 1]
      const suffix = activeFilePath.slice(sourcePath.length)
      const newActivePath = [...destFolderPath, moved, ...suffix]
      patch = {
        ...patch,
        activeFilePath: newActivePath,
        activeFile: newActivePath[newActivePath.length - 1],
        activeAbsolutePath: settings.fileStoragePath
          ? absFromTreePath(settings.fileStoragePath, newActivePath)
          : null,
      }
    }
    set(patch)
  },

  settings: loadSettings(),
  settingsOpen: false,

  setSettings: (partial) => {
    const { settings } = get()
    const next = { ...settings, ...partial }
    saveSettings(next)
    set({ settings: next })
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  helpModal: null,
  setHelpModal: (kind) => set({ helpModal: kind }),

  findOpen: false,
  findMode: 'find',
  setFindOpen: (open, mode) =>
    set((s) => ({ findOpen: open, findMode: mode ?? s.findMode })),

  tablePickerOpen: false,
  setTablePickerOpen: (open) => set({ tablePickerOpen: open }),

  recentFiles: loadRecentFiles(),
  addRecentFile: (entry) => {
    const { recentFiles } = get()
    const key = (e: RecentFileEntry) => e.absolutePath ?? e.path.join('/') + '::' + e.name
    const target = key(entry)
    const next = [entry, ...recentFiles.filter((f) => key(f) !== target)].slice(0, 10)
    saveRecentFiles(next)
    set({ recentFiles: next })
  },
  removeRecentFile: (entry) => {
    const { recentFiles } = get()
    const key = (e: RecentFileEntry) => e.absolutePath ?? e.path.join('/') + '::' + e.name
    const target = key(entry)
    const next = recentFiles.filter((f) => key(f) !== target)
    saveRecentFiles(next)
    set({ recentFiles: next })
  },
  clearRecentFiles: () => {
    saveRecentFiles([])
    set({ recentFiles: [] })
  },

  editingPath: null,
  setEditingPath: (path) => set({ editingPath: path }),

  lastSavedDoc: initialDoc,
  markSaved: () => set((s) => ({ lastSavedDoc: s.doc })),

  selectedPaths: [],
  deleteSelectedFromTree: (options) => {
    const alsoDeleteOnDisk = options?.alsoDeleteOnDisk ?? false
    const { files, selectedPaths, activeFilePath, settings } = get()
    if (selectedPaths.length === 0) return
    // Sort deepest-first so sibling indices don't shift.
    const sorted = [...selectedPaths].sort(
      (a, b) => b.length - a.length || b.join('/').localeCompare(a.join('/')),
    )
    const plan = sorted.map((p) => ({ path: p, node: findNodeByPath(files, p) }))

    let next = files
    let clearActive = false
    for (const { path } of plan) {
      if (pathIsPrefix(path, activeFilePath)) clearActive = true
      next = removeNode(next, path)
    }
    if (clearActive) {
      set({
        files: next,
        selectedPaths: [],
        activeFile: '',
        activeFilePath: [],
        activeAbsolutePath: null,
        doc: '',
        lastSavedDoc: '',
      })
    } else {
      set({ files: next, selectedPaths: [] })
    }

    // Mirror to disk only when the user explicitly confirmed "also delete local".
    if (alsoDeleteOnDisk && isTauri() && settings.fileStoragePath) {
      const root = settings.fileStoragePath.replace(/[\\/]+$/, '')
      for (const { path, node } of plan) {
        if (!node) continue
        const fullPath = [root, ...path].join('/')
        moveToTrash(fullPath, node.type === 'folder').catch((err) =>
          console.error('Failed to move to trash:', err),
        )
      }
    }
  },
  setSelectedPaths: (paths) => set({ selectedPaths: paths }),
  toggleSelectPath: (path, additive) => {
    const { selectedPaths } = get()
    const key = path.join('/')
    const exists = selectedPaths.some((p) => p.join('/') === key)
    if (additive) {
      set({
        selectedPaths: exists
          ? selectedPaths.filter((p) => p.join('/') !== key)
          : [...selectedPaths, path],
      })
    } else {
      set({ selectedPaths: exists && selectedPaths.length === 1 ? [] : [path] })
    }
  },
  clearSelectedPaths: () => set({ selectedPaths: [] }),
}))

// ── Persistence: auto-save UI prefs whenever any tracked field changes.
// Subscribed once at module load — runs for the lifetime of the page.
// Cheap: only writes when a tracked key actually changed (shallow diff
// driven by zustand's update notification).
;(() => {
  let last = {
    theme: _prefs.theme,
    sidebarVisible: _prefs.sidebarVisible,
    sidebarWidth: _prefs.sidebarWidth,
    activeTab: _prefs.activeTab,
    editorMode: _prefs.editorMode,
    focusMode: _prefs.focusMode,
    typewriterMode: _prefs.typewriterMode,
    zoom: _prefs.zoom,
    fileSort: _prefs.fileSort,
  }
  useAppStore.subscribe((state) => {
    const next = {
      theme: state.theme,
      sidebarVisible: state.sidebarVisible,
      sidebarWidth: state.sidebarWidth,
      activeTab: state.activeTab,
      editorMode: state.editorMode,
      focusMode: state.focusMode,
      typewriterMode: state.typewriterMode,
      zoom: state.zoom,
      fileSort: state.fileSort,
    }
    let changed = false
    for (const k of Object.keys(next) as (keyof typeof next)[]) {
      if (next[k] !== last[k]) { changed = true; break }
    }
    if (changed) {
      last = next
      savePrefs(next)
    }
  })
})()
