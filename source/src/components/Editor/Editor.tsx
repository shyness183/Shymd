import { useState, useRef } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { SourceEditor } from './SourceEditor'
import { ReadingView } from './ReadingView'
import { WysiwygEditor } from './WysiwygEditor'
import { FloatingToolbar } from './FloatingToolbar'
import { insertNode, uniqueName } from '../../lib/fileTreeUtils'
import styles from './Editor.module.css'

const MD_EXT_RE = /\.(md|markdown|mdown|mkdn|mkd)$/i

export function Editor() {
  const editorMode = useAppStore((s) => s.editorMode)
  const [dragActive, setDragActive] = useState(false)
  const dragDepthRef = useRef(0)

  let editor
  switch (editorMode) {
    case 'source':
      editor = <SourceEditor />
      break
    case 'reading':
      editor = <ReadingView />
      break
    case 'wysiwyg':
    default:
      editor = <WysiwygEditor />
  }

  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current += 1
    setDragActive(true)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setDragActive(false)
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return
    e.preventDefault()
    dragDepthRef.current = 0
    setDragActive(false)

    const mdFiles = Array.from(e.dataTransfer.files).filter(
      (f) => MD_EXT_RE.test(f.name) || f.type === 'text/markdown',
    )
    if (mdFiles.length === 0) return

    let state = useAppStore.getState()
    let nextFiles = state.files
    let lastName = ''
    let lastText = ''

    for (const file of mdFiles) {
      const text = await file.text()
      const finalName = uniqueName(nextFiles, file.name)
      nextFiles = insertNode(nextFiles, [], {
        name: finalName,
        type: 'file',
        content: text,
      })
      lastName = finalName
      lastText = text
    }

    useAppStore.setState({
      files: nextFiles,
      activeFile: lastName,
      activeFilePath: [lastName],
      activeAbsolutePath: null,
      doc: lastText,
      lastSavedDoc: lastText,
    })
  }

  return (
    <div
      className={`${styles.dropZone}${dragActive ? ' ' + styles.dropZoneActive : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {editor}
      <FloatingToolbar />
      {dragActive && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropHint}>拖放 .md 文件到此处导入</div>
        </div>
      )}
    </div>
  )
}
