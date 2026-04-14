import { useAppStore } from '../stores/useAppStore'
import { md } from './markdown'
import { insertNode, uniqueName } from './fileTreeUtils'
import {
  isTauri,
  pickMarkdownFile,
  pickFolder,
  saveFileDialog,
  readFileText,
  readDirTree,
  writeFileText,
  joinPath,
} from './filesystem'

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
  const { doc, activeFile, settings } = useAppStore.getState()
  const name = activeFile || 'untitled.md'
  const filename = name.endsWith('.md') ? name : name + '.md'

  if (isTauri()) {
    if (!settings.fileStoragePath) {
      // Path not configured — prompt user, then open settings
      const dialog = await import('@tauri-apps/plugin-dialog')
      await dialog.message(
        '您还未配置文件存储路径，请在偏好设置中配置后再保存。',
        { title: 'Shymd', kind: 'warning' },
      )
      useAppStore.getState().setSettingsOpen(true)
      return
    }
    const filePath = joinPath(settings.fileStoragePath, [filename])
    await writeFileText(filePath, doc)
    return
  }

  // Browser fallback: download
  downloadBlob(filename, new Blob([doc], { type: 'text/markdown;charset=utf-8' }))
}

export async function saveMarkdownAs() {
  const { doc, activeFile } = useAppStore.getState()
  const name = activeFile || 'untitled.md'
  const filename = name.endsWith('.md') ? name : name + '.md'

  if (isTauri()) {
    const path = await saveFileDialog(filename)
    if (!path) return
    await writeFileText(path, doc)
    return
  }

  // Browser fallback
  downloadBlob(filename, new Blob([doc], { type: 'text/markdown;charset=utf-8' }))
}

export function exportHTML() {
  const { doc, activeFile } = useAppStore.getState()
  const title = (activeFile || 'document').replace(/\.md$/, '')
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
  downloadBlob(`${title}.html`, new Blob([html], { type: 'text/html;charset=utf-8' }))
}

export function newFile() {
  const { createFile } = useAppStore.getState()
  createFile([], '未命名.md')
}

export async function openMarkdown() {
  if (isTauri()) {
    const filePath = await pickMarkdownFile()
    if (!filePath) return
    const text = await readFileText(filePath)
    // Extract filename from path
    const name = filePath.split(/[/\\]/).pop() || 'untitled.md'

    const state = useAppStore.getState()
    const finalName = uniqueName(state.files, name)
    const nextFiles = insertNode(state.files, [], {
      name: finalName,
      type: 'file',
      content: text,
    })
    useAppStore.setState({
      files: nextFiles,
      activeFile: finalName,
      doc: text,
    })
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

    const finalName = uniqueName(state.files, file.name)
    const nextFiles = insertNode(state.files, [], {
      name: finalName,
      type: 'file',
      content: text,
    })
    useAppStore.setState({
      files: nextFiles,
      activeFile: finalName,
      doc: text,
    })
  }
  input.click()
}

/** Open a folder from disk (Tauri only). Loads .md files into the tree. */
export async function openFolder() {
  if (!isTauri()) return

  const dirPath = await pickFolder()
  if (!dirPath) return

  const tree = await readDirTree(dirPath)
  const folderName = dirPath.split(/[/\\]/).pop() || 'folder'

  useAppStore.setState({
    files: [{ name: folderName, type: 'folder', children: tree }],
    activeFile: '',
    doc: '',
  })
  useAppStore.getState().setSettings({ fileStoragePath: dirPath })
}
