import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { isTauri, readDirTree, pathExists } from '../lib/filesystem'
import { showToast } from '../components/Toast/Toast'

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

    // Use a monotonically-increasing sequence number instead of a boolean
    // `cancelled` flag.  Rapid A→B→A path changes would reuse a boolean
    // (it gets reset to `false` by the latest effect run), accepting a
    // stale result from the first scan.  A counter avoids this entirely.
    const seq = ++_loadSeq
    const targetPath = fileStoragePath // snapshot for the async closure

    ;(async () => {
      try {
        const exists = await pathExists(targetPath)
        if (seq !== _loadSeq) return
        if (!exists) {
          showToast(`文件存储路径不存在：${targetPath}`, 'warn', 5000)
          useAppStore.setState({ files: [] })
          return
        }

        const tree = await readDirTree(targetPath)
        if (seq !== _loadSeq) return

        useAppStore.setState({ files: tree })
      } catch (err) {
        if (seq !== _loadSeq) return
        console.error('Failed to load file tree from fileStoragePath:', err)
        showToast(
          `无法读取文件夹，请检查权限：${targetPath}`,
          'error',
          5000,
        )
      }
    })()
  }, [fileStoragePath])
}

// Module-level sequence counter — each effect run gets a unique ID.
let _loadSeq = 0
