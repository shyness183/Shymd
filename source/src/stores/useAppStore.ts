import { create } from 'zustand'
import type { AppState } from '../types'
import { defaultDoc } from './defaultDoc'
import { sampleFiles } from './sampleFiles'
import {
  insertNode,
  removeNode,
  renameNodeInTree,
  updateContentByName,
  uniqueName,
  moveNode as moveNodeInTree,
} from '../lib/fileTreeUtils'
import { loadSettings, saveSettings } from '../lib/settingsStorage'
import { isTauri, writeFileText, createDir, removePath, renamePath } from '../lib/filesystem'

// Start with a fresh, empty editor on every launch (like Notepad).
// Past files live in "Recent Files" history, and — in Tauri — on disk.
// First-run users still see the sample welcome file to help onboarding.
const isFirstRun = typeof localStorage !== 'undefined' && !localStorage.getItem('shymd-launched')
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('shymd-launched', '1')
}
const initialFiles = isFirstRun ? sampleFiles : []
const initialActiveFile = isFirstRun ? '欢迎使用 Shymd.md' : ''
const initialDoc = isFirstRun ? defaultDoc : ''

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'light',
  sidebarVisible: true,
  sidebarWidth: 240,
  activeTab: 'files',
  editorMode: 'wysiwyg',
  doc: initialDoc,
  activeFile: initialActiveFile,
  focusMode: false,
  typewriterMode: false,
  zoom: 100,
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

  setDoc: (content) => {
    const { activeFile, files } = get()
    set({
      doc: content,
      files: updateContentByName(files, activeFile, content),
    })
  },

  setActiveFile: (name, content) => {
    set({ activeFile: name, doc: content })
    if (name) get().addRecentFile(name)
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
    // Find siblings to ensure unique name
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
    set({ files: newFiles, activeFile: finalName, doc: '', lastSavedDoc: '' })

    // Write the new empty file to disk if Tauri + fileStoragePath configured
    if (isTauri() && settings.fileStoragePath) {
      const fullPath = [
        settings.fileStoragePath.replace(/[\\/]+$/, ''),
        ...parentPath,
        finalName,
      ].join('/')
      writeFileText(fullPath, '').catch((err) =>
        console.error('Failed to create file on disk:', err),
      )
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
      const fullPath = [
        settings.fileStoragePath.replace(/[\\/]+$/, ''),
        ...parentPath,
        finalName,
      ].join('/')
      createDir(fullPath).catch((err) =>
        console.error('Failed to create folder on disk:', err),
      )
    }
  },

  deleteNode: (path) => {
    const { files, activeFile, settings } = get()
    const nodeName = path[path.length - 1]

    // Determine if it's a file or folder for disk removal
    const findNode = (tree: typeof files, segs: string[]): typeof files[0] | null => {
      let current: typeof files = tree
      let node: typeof files[0] | null = null
      for (const seg of segs) {
        node = current.find((n) => n.name === seg) ?? null
        if (!node) return null
        if (node.children) current = node.children
      }
      return node
    }
    const node = findNode(files, path)
    const newFiles = removeNode(files, path)

    if (nodeName === activeFile) {
      set({ files: newFiles, activeFile: '', doc: '', lastSavedDoc: '' })
    } else {
      set({ files: newFiles })
    }

    // Mirror to disk if configured
    if (isTauri() && settings.fileStoragePath && node) {
      const fullPath = [
        settings.fileStoragePath.replace(/[\\/]+$/, ''),
        ...path,
      ].join('/')
      removePath(fullPath, node.type === 'folder').catch((err) =>
        console.error('Failed to delete on disk:', err),
      )
    }
  },

  renameNode: (path, newName) => {
    const { files, activeFile, settings } = get()
    const oldName = path[path.length - 1]
    const newFiles = renameNodeInTree(files, path, newName)

    if (oldName === activeFile) {
      set({ files: newFiles, activeFile: newName })
    } else {
      set({ files: newFiles })
    }

    // Mirror to disk
    if (isTauri() && settings.fileStoragePath) {
      const root = settings.fileStoragePath.replace(/[\\/]+$/, '')
      const oldPath = [root, ...path].join('/')
      const newPath = [root, ...path.slice(0, -1), newName].join('/')
      renamePath(oldPath, newPath).catch((err) =>
        console.error('Failed to rename on disk:', err),
      )
    }
  },

  moveNode: (sourcePath, destFolderPath) => {
    const { files } = get()
    const result = moveNodeInTree(files, sourcePath, destFolderPath)
    if (!result) return
    // If moving the active file, activeFile name stays the same (may have been
    // renamed by uniqueName — but that's an edge case we accept for now).
    set({ files: result })
  },

  updateFileContent: (name, content) => {
    const { files } = get()
    set({ files: updateContentByName(files, name, content) })
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

  recentFiles: JSON.parse(localStorage.getItem('shymd-recent') || '[]') as string[],
  addRecentFile: (name) => {
    const { recentFiles } = get()
    const next = [name, ...recentFiles.filter((f) => f !== name)].slice(0, 10)
    localStorage.setItem('shymd-recent', JSON.stringify(next))
    set({ recentFiles: next })
  },
  removeRecentFile: (name) => {
    const { recentFiles } = get()
    const next = recentFiles.filter((f) => f !== name)
    localStorage.setItem('shymd-recent', JSON.stringify(next))
    set({ recentFiles: next })
  },
  clearRecentFiles: () => {
    localStorage.removeItem('shymd-recent')
    set({ recentFiles: [] })
  },

  editingPath: null,
  setEditingPath: (path) => set({ editingPath: path }),

  lastSavedDoc: initialDoc,
  markSaved: () => set((s) => ({ lastSavedDoc: s.doc })),

  selectedPaths: [],
  deleteSelectedFromTree: () => {
    // Remove selected nodes from the in-memory file tree only. Does NOT touch
    // the on-disk files (matches user-requested behavior: "一键删除, 不影响本地文件").
    const { files, selectedPaths, activeFile } = get()
    if (selectedPaths.length === 0) return
    // Sort deepest-first so sibling indices don't shift.
    const sorted = [...selectedPaths].sort(
      (a, b) => b.length - a.length || b.join('/').localeCompare(a.join('/')),
    )
    let next = files
    let clearActive = false
    for (const path of sorted) {
      const nodeName = path[path.length - 1]
      if (nodeName === activeFile) clearActive = true
      next = removeNode(next, path)
    }
    if (clearActive) {
      set({ files: next, selectedPaths: [], activeFile: '', doc: '', lastSavedDoc: '' })
    } else {
      set({ files: next, selectedPaths: [] })
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
