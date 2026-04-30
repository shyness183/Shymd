import { useAppStore } from '../stores/useAppStore'
import { md } from './markdown'
import { uniqueName } from './fileTreeUtils'
import {
  isTauri,
  pickMarkdownFile,
  pickFolder,
  saveFileDialog,
  readDirTree,
  writeFileText,
  joinPath,
} from './filesystem'
import { showToast } from '../components/Toast/Toast'

// Trigger a browser download
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function saveMarkdown() {
  const { doc, activeFile, activeAbsolutePath, settings } = useAppStore.getState()
  const name = activeFile || 'untitled.md'
  const filename = name.endsWith('.md') ? name : name + '.md'

  if (isTauri()) {
    const dialog = await import('@tauri-apps/plugin-dialog')

    // If we know the absolute path (opened file), just write to it.
    if (activeAbsolutePath) {
      try {
        await writeFileText(activeAbsolutePath, doc)
        useAppStore.getState().markSaved()
        return
      } catch (err) {
        await dialog.message(
          `保存失败：${err instanceof Error ? err.message : String(err)}`,
          { title: 'Shymd', kind: 'error' },
        )
        return
      }
    }

    // No absolute path — fall back to writing under the workspace.
    if (!settings.fileStoragePath) {
      await dialog.message(
        '您还未配置文件存储路径，请在偏好设置中配置后再保存。',
        { title: 'Shymd', kind: 'warning' },
      )
      useAppStore.getState().setSettingsOpen(true)
      return
    }
    try {
      const filePath = joinPath(settings.fileStoragePath, [filename])
      await writeFileText(filePath, doc)
      useAppStore.getState().markSaved()
      // Record the absolute path so subsequent autosave / Ctrl+S write
      // directly to this file instead of asking for the workspace again.
      useAppStore.setState({ activeAbsolutePath: filePath })
      return
    } catch (err) {
      await dialog.message(
        `保存失败：${err instanceof Error ? err.message : String(err)}`,
        { title: 'Shymd', kind: 'error' },
      )
      return
    }
  }

  // Browser fallback: download
  downloadBlob(filename, new Blob([doc], { type: 'text/markdown;charset=utf-8' }))
  useAppStore.getState().markSaved()
}

export async function saveMarkdownAs() {
  const { doc, activeFile, settings } = useAppStore.getState()
  const name = activeFile || 'untitled.md'
  const filename = name.endsWith('.md') ? name : name + '.md'

  if (isTauri()) {
    const dialog = await import('@tauri-apps/plugin-dialog')
    try {
      const path = await saveFileDialog(filename, settings.fileStoragePath || undefined)
      if (!path) return
      const finalPath = path.endsWith('.md') ? path : path + '.md'
      await writeFileText(finalPath, doc)
      // Re-open the saved file so subsequent edits autosave to the new path.
      await useAppStore.getState().openFileByAbsolutePath(finalPath)
      useAppStore.getState().markSaved()
      return
    } catch (err) {
      await dialog.message(
        `保存失败：${err instanceof Error ? err.message : String(err)}`,
        { title: 'Shymd', kind: 'error' },
      )
      return
    }
  }

  // Browser fallback
  downloadBlob(filename, new Blob([doc], { type: 'text/markdown;charset=utf-8' }))
  useAppStore.getState().markSaved()
}

export async function exportHTML() {
  const { doc, activeFile, settings } = useAppStore.getState()
  const rawTitle = (activeFile || 'document').replace(/\.md$/, '')
  const title = rawTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const body = md.render(doc)
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: "Source Han Sans SC", system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.75; color: #2C2C2C; }
  h1, h2, h3, h4, h5, h6 { color: #1A1A1A; }
  pre { background: #F4F1EE; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { background: #F4F1EE; padding: 2px 6px; border-radius: 3px; font-family: "JetBrains Mono", monospace; }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 3px solid #D4775C; padding-left: 1em; color: #6B6B6B; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #E5E5E5; padding: 6px 10px; text-align: left; }
  mark { background: rgba(255, 235, 59, 0.35); padding: 0 2px; }
  img { max-width: 100%; }
</style>
</head>
<body>
${body}
</body>
</html>`
  const filename = `${title}.html`

  if (isTauri() && settings.downloadPath) {
    // Use configured download path directly
    const filePath = joinPath(settings.downloadPath, [filename])
    await writeFileText(filePath, html)
    const dialog = await import('@tauri-apps/plugin-dialog')
    await dialog.message(`已导出到：${filePath}`, { title: 'Shymd', kind: 'info' })
    return
  }

  // Fallback: browser download
  downloadBlob(filename, new Blob([html], { type: 'text/html;charset=utf-8' }))
}

export function newFile() {
  const state = useAppStore.getState()
  const name = uniqueName(state.files, '未命名.md')
  state.createFile([], name)
  state.setEditingPath([name])
}

export async function openMarkdown() {
  if (isTauri()) {
    const filePath = await pickMarkdownFile()
    if (!filePath) return
    // Use the new absolute-path opener: if the file is inside the
    // workspace, the sidebar highlights it; otherwise it opens standalone
    // and autosave writes back to wherever it came from.
    await useAppStore.getState().openFileByAbsolutePath(filePath)
    return
  }

  // Browser fallback: use hidden file input
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,text/markdown'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const state = useAppStore.getState()
    // Browser has no real filesystem — fake it as an in-memory entry.
    state.setActiveFile(file.name, text, [file.name])
  }
  input.click()
}

/** Open a folder from disk (Tauri only). Loads .md files into the tree. */
export async function openFolder() {
  if (!isTauri()) return

  const dirPath = await pickFolder()
  if (!dirPath) return

  try {
    const tree = await readDirTree(dirPath)
    useAppStore.setState({
      files: tree,
      activeFile: '',
      activeFilePath: [],
      activeAbsolutePath: null,
      doc: '',
      lastSavedDoc: '',
    })
    useAppStore.getState().setSettings({ fileStoragePath: dirPath })
  } catch (err) {
    console.error('Failed to open folder:', err)
    showToast('无法读取所选文件夹', 'error')
  }
}
