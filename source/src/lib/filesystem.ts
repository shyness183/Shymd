/**
 * Filesystem abstraction layer.
 *
 * In Tauri: uses @tauri-apps/plugin-fs for real file I/O.
 * In browser: falls back to in-memory FileNode operations (no persistence).
 */

import type { FileNode } from '../types'

// ── Environment detection ──────────────────────────────────────────
export function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__
}

// ── Tauri filesystem helpers ───────────────────────────────────────

async function getTauriFsModule() {
  return await import('@tauri-apps/plugin-fs')
}

/** Read a directory recursively, producing a FileNode tree. */
export async function readDirTree(dirPath: string): Promise<FileNode[]> {
  if (!isTauri()) return []

  const fs = await getTauriFsModule()
  const entries = await fs.readDir(dirPath)
  const nodes: FileNode[] = []

  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry.name}`
    if (entry.isDirectory) {
      const children = await readDirTree(fullPath)
      nodes.push({ name: entry.name, type: 'folder', children })
    } else if (entry.name.endsWith('.md')) {
      // Only load .md files into the tree
      nodes.push({ name: entry.name, type: 'file' })
    }
  }

  // Sort: folders first, then alphabetical
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

/** Read a file's text content. */
export async function readFileText(filePath: string): Promise<string> {
  if (!isTauri()) return ''
  const fs = await getTauriFsModule()
  return await fs.readTextFile(filePath)
}

/** Write text content to a file. Creates the file if it doesn't exist. */
export async function writeFileText(filePath: string, content: string): Promise<void> {
  if (!isTauri()) return
  const fs = await getTauriFsModule()
  await fs.writeTextFile(filePath, content)
}

/** Create a directory (recursive). */
export async function createDir(dirPath: string): Promise<void> {
  if (!isTauri()) return
  const fs = await getTauriFsModule()
  await fs.mkdir(dirPath, { recursive: true })
}

/** Remove a file or directory. */
export async function removePath(path: string, isDir: boolean): Promise<void> {
  if (!isTauri()) return
  const fs = await getTauriFsModule()
  if (isDir) {
    await fs.remove(path, { recursive: true })
  } else {
    await fs.remove(path)
  }
}

/** Rename / move a file or directory. */
export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  if (!isTauri()) return
  const fs = await getTauriFsModule()
  await fs.rename(oldPath, newPath)
}

/** Check if a path exists. */
export async function pathExists(path: string): Promise<boolean> {
  if (!isTauri()) return false
  const fs = await getTauriFsModule()
  return await fs.exists(path)
}

// ── Dialog helpers ─────────────────────────────────────────────────

async function getDialogModule() {
  return await import('@tauri-apps/plugin-dialog')
}

/** Open a file picker for .md files. Returns the file path or null. */
export async function pickMarkdownFile(): Promise<string | null> {
  if (!isTauri()) return null
  const dialog = await getDialogModule()
  const result = await dialog.open({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    multiple: false,
  })
  return typeof result === 'string' ? result : (result as any)?.path ?? null
}

/** Open a folder picker. Returns the folder path or null. */
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null
  const dialog = await getDialogModule()
  const result = await dialog.open({ directory: true })
  return typeof result === 'string' ? result : null
}

/** Save-file dialog. Returns the chosen path or null. */
export async function saveFileDialog(defaultName: string): Promise<string | null> {
  if (!isTauri()) return null
  const dialog = await getDialogModule()
  const result = await dialog.save({
    defaultPath: defaultName,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  return result ?? null
}

// ── App directory helpers ─────────────────────────────────────────

/** Get the directory containing the running exe (Tauri) or empty string (browser). */
export async function getAppBaseDir(): Promise<string> {
  if (!isTauri()) return ''
  try {
    const { resourceDir } = await import('@tauri-apps/api/path')
    const dir = await resourceDir()
    // resourceDir returns the _resources dir inside the bundle; go up one level to get the exe dir
    return dir.replace(/[\\/]_up_[\\/]?$/, '').replace(/[\\/][^\\/]+[\\/]?$/, '')
  } catch {
    return ''
  }
}

// ── Browser image picker (non-Tauri) ─────────────────────────────

/** Pick an image via browser file input. Returns a data URL or null. */
export function pickImageBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/bmp'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

// ── Utility: build an absolute path from rootDir + path segments ──

export function joinPath(rootDir: string, segments: string[]): string {
  const parts = [rootDir, ...segments]
  return parts.join('/')
}
