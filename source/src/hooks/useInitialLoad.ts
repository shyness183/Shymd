import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { isTauri, readDirTree, pathExists, readFileText } from '../lib/filesystem'
import { defaultDoc } from '../stores/defaultDoc'

/**
 * On app start, if a `fileStoragePath` is configured in settings and the
 * directory exists on disk, scan it recursively and replace the file tree
 * with what's actually on disk.
 *
 * This ensures the sidebar reflects the user's real storage folder rather
 * than a stale in-memory tree.
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

        // Replace file tree with disk contents. If there's an activeFile
        // that still exists in the tree, read its content; otherwise fall
        // back to the welcome doc.
        const findFirstFile = (nodes: typeof tree): { name: string; path: string[] } | null => {
          for (const n of nodes) {
            if (n.type === 'file') return { name: n.name, path: [n.name] }
            if (n.type === 'folder' && n.children) {
              const inner = findFirstFile(n.children)
              if (inner) return { name: inner.name, path: [n.name, ...inner.path] }
            }
          }
          return null
        }

        const first = findFirstFile(tree)
        if (first) {
          const fullPath = [fileStoragePath, ...first.path].join('/')
          const content = await readFileText(fullPath)
          if (cancelled) return
          useAppStore.setState({
            files: tree,
            activeFile: first.name,
            doc: content,
          })
        } else {
          // Empty directory — keep welcome doc
          useAppStore.setState({
            files: tree,
            activeFile: '',
            doc: defaultDoc,
          })
        }
      } catch (err) {
        console.error('Failed to load file tree from fileStoragePath:', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fileStoragePath])
}
