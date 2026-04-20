import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { isTauri, writeFileText } from '../lib/filesystem'
import type { FileNode } from '../types'

/** Find the path (as array of segments) to a file by name in the tree. */
function findFilePath(nodes: FileNode[], target: string, acc: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.type === 'file' && n.name === target) return [...acc, n.name]
    if (n.type === 'folder' && n.children) {
      const found = findFilePath(n.children, target, [...acc, n.name])
      if (found) return found
    }
  }
  return null
}

/**
 * Autosave the current session (files + activeFile + doc) to
 * localStorage so a tab crash or accidental refresh doesn't lose work.
 *
 * - Debounced by the user-configured `autoSaveDelay` (default 1s)
 * - Also saves on `beforeunload` and on tab visibility change to
 *   catch tab close / OS sleep.
 * - Respects the `settings.autoSave` toggle.
 */
export function useAutosave() {
  const timerRef = useRef<number | null>(null)

  const files = useAppStore((s) => s.files)
  const activeFile = useAppStore((s) => s.activeFile)
  const doc = useAppStore((s) => s.doc)
  const autoSave = useAppStore((s) => s.settings.autoSave)
  const delay = useAppStore((s) => s.settings.autoSaveDelay)

  // Debounced save on state changes
  useEffect(() => {
    if (!autoSave) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      // In Tauri, persist the active doc to its real file on disk.
      if (isTauri() && activeFile) {
        const storage = useAppStore.getState().settings.fileStoragePath
        if (storage) {
          const segments = findFilePath(files, activeFile)
          if (segments) {
            const fullPath = [storage.replace(/[\\/]+$/, ''), ...segments].join('/')
            writeFileText(fullPath, doc)
              .then(() => useAppStore.getState().markSaved())
              .catch((err) =>
                console.error('Autosave to disk failed:', err),
              )
          }
        }
      }
    }, Math.max(200, delay))
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [files, activeFile, doc, autoSave, delay])

  // Flush to disk on tab close / visibility change (Tauri only).
  useEffect(() => {
    const flush = () => {
      if (!useAppStore.getState().settings.autoSave) return
      if (!isTauri()) return
      const s = useAppStore.getState()
      if (!s.activeFile) return
      const storage = s.settings.fileStoragePath
      if (!storage) return
      const segments = findFilePath(s.files, s.activeFile)
      if (!segments) return
      const fullPath = [storage.replace(/[\\/]+$/, ''), ...segments].join('/')
      writeFileText(fullPath, s.doc).catch(() => {
        // best-effort — ignore errors on close
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
