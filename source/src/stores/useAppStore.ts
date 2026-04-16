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
import { loadPersistedSession } from '../lib/persistState'

// Hydrate files/activeFile/doc from the last session if present (crash
// recovery). Falls back to sample data on first run.
const persisted = loadPersistedSession()
const initialFiles = persisted?.files ?? sampleFiles
const initialActiveFile = persisted?.activeFile ?? '欢迎使用 Shymd.md'
const initialDoc = persisted?.doc ?? defaultDoc

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
    const { files } = get()
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
    set({ files: newFiles, activeFile: finalName, doc: '' })
  },

  createFolder: (parentPath, name) => {
    const { files } = get()
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
  },

  deleteNode: (path) => {
    const { files, activeFile } = get()
    const nodeName = path[path.length - 1]
    const newFiles = removeNode(files, path)
    // If the deleted file was active, clear editor
    if (nodeName === activeFile) {
      set({ files: newFiles, activeFile: '', doc: '' })
    } else {
      set({ files: newFiles })
    }
  },

  renameNode: (path, newName) => {
    const { files, activeFile } = get()
    const oldName = path[path.length - 1]
    const newFiles = renameNodeInTree(files, path, newName)
    // If renaming the active file, update activeFile
    if (oldName === activeFile) {
      set({ files: newFiles, activeFile: newName })
    } else {
      set({ files: newFiles })
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
  clearRecentFiles: () => {
    localStorage.removeItem('shymd-recent')
    set({ recentFiles: [] })
  },

  editingPath: null,
  setEditingPath: (path) => set({ editingPath: path }),
}))
