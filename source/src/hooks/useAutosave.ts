import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { savePersistedSession } from '../lib/persistState'

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
      savePersistedSession({ files, activeFile, doc, savedAt: Date.now() })
    }, Math.max(200, delay))
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [files, activeFile, doc, autoSave, delay])

  // Flush on tab close / visibility change
  useEffect(() => {
    const flush = () => {
      if (!useAppStore.getState().settings.autoSave) return
      const s = useAppStore.getState()
      savePersistedSession({
        files: s.files,
        activeFile: s.activeFile,
        doc: s.doc,
        savedAt: Date.now(),
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
