import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { isTauri, writeFileText } from '../lib/filesystem'
import { showToast } from '../components/Toast/Toast'

/**
 * Autosave the active file to disk (Tauri only).
 *
 * - Debounced by the user-configured `autoSaveDelay` (default 1s)
 * - Also saves on `beforeunload` and on tab visibility change to
 *   catch tab close / OS sleep.
 * - Respects the `settings.autoSave` toggle.
 * - Writes directly to `activeAbsolutePath`, NOT by looking up the file
 *   name in the tree — that was the old behaviour and silently corrupted
 *   the wrong file when two files shared a name.
 */
export function useAutosave() {
  const timerRef = useRef<number | null>(null)
  // Track whether we've already warned the user about missing disk path
  // so we only show the toast once per session.
  const warnedNoPathRef = useRef(false)

  const activeAbsolutePath = useAppStore((s) => s.activeAbsolutePath)
  const doc = useAppStore((s) => s.doc)
  const autoSave = useAppStore((s) => s.settings.autoSave)
  const delay = useAppStore((s) => s.settings.autoSaveDelay)

  // Debounced save on state changes
  useEffect(() => {
    if (!autoSave) return
    if (!isTauri()) return
    if (!activeAbsolutePath) {
      if (!warnedNoPathRef.current && doc.trim()) {
        warnedNoPathRef.current = true
        showToast('自动保存未生效 — 请先用 Ctrl+S 保存文件到磁盘', 'warn')
      }
      return
    }
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      writeFileText(activeAbsolutePath, doc)
        .then(() => useAppStore.getState().markSaved())
        .catch((err) => {
          console.error('Autosave to disk failed:', err)
          showToast('保存失败，请检查文件权限', 'error')
        })
    }, Math.max(200, delay))
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [activeAbsolutePath, doc, autoSave, delay])

  // Flush to disk on tab close / visibility change (Tauri only).
  useEffect(() => {
    const flush = () => {
      const s = useAppStore.getState()
      if (!s.settings.autoSave) return
      if (!isTauri()) return
      if (!s.activeAbsolutePath) return
      writeFileText(s.activeAbsolutePath, s.doc).catch((err) => {
        console.error('Autosave flush on close failed:', err)
        // Show a toast so the user knows their changes may be lost.
        // We can't block the close, but at least the user is informed.
        showToast('关闭前保存失败，请检查文件权限', 'error', 4000)
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
