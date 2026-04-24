import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { isTauri, readDirTree, pathExists } from '../lib/filesystem'

/**
 * On app start, if a `fileStoragePath` is configured in settings and the
 * directory exists on disk, scan it recursively and replace the file tree
 * with what's actually on disk.
 *
 * This ensures the sidebar reflects the user's real storage folder rather
 * than a stale in-memory tree.
 *
 * Fresh-launch behavior (like Notepad): the editor stays blank until the
 * user clicks a file in the sidebar. We do NOT auto-open the first file,
 * because that gives the impression the editor is "stuck on the previous
 * file" when the real file contents haven't loaded yet.
 *
 * Runs once on mount AND whenever `fileStoragePath` changes in settings.
 */
export function useInitialLoad() {
  const fileStoragePath = useAppStore((s) => s.settings.fileStoragePath)

  useEffect(() => {
    if (!isTauri()) return
    if (!fileStoragePath) return

    let cancelled = false
    ;(async () => {
      try {
        const exists = await pathExists(fileStoragePath)
        if (!exists || cancelled) return

        const tree = await readDirTree(fileStoragePath)
        if (cancelled) return

        // Populate the sidebar with what's on disk, but leave the editor
        // blank — user picks which file to open.
        useAppStore.setState({ files: tree })
      } catch (err) {
        console.error('Failed to load file tree from fileStoragePath:', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fileStoragePath])
}
