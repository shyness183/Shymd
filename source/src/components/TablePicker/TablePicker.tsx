import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { cmdTable, getEditorView } from '../../lib/editorCommands'
import { htmlTable, getCERoot } from '../../lib/htmlEditorCommands'
import styles from './TablePicker.module.css'

const MAX_ROWS = 8
const MAX_COLS = 10

export function TablePicker() {
  const open = useAppStore((s) => s.tablePickerOpen)
  const setOpen = useAppStore((s) => s.setTablePickerOpen)
  const editorMode = useAppStore((s) => s.editorMode)
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: 1, c: 3 })

  useEffect(() => {
    if (!open) return
    setHover({ r: 1, c: 3 })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const pick = (r: number, c: number) => {
    if (editorMode === 'wysiwyg' && getCERoot()) {
      htmlTable(r, c)
    } else if (editorMode === 'source' && getEditorView()) {
      cmdTable(r, c)
    }
    setOpen(false)
  }

  return (
    <div className={styles.backdrop} onClick={() => setOpen(false)}>
      <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>插入表格</div>
        <div className={styles.label}>
          {hover.r} 行 × {hover.c} 列
        </div>
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(${MAX_COLS}, 24px)`,
            gridTemplateRows: `repeat(${MAX_ROWS}, 24px)`,
          }}
        >
          {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, i) => {
            const r = Math.floor(i / MAX_COLS) + 1
            const c = (i % MAX_COLS) + 1
            const active = r <= hover.r && c <= hover.c
            return (
              <div
                key={i}
                className={`${styles.cell} ${active ? styles.cellActive : ''}`}
                onMouseEnter={() => setHover({ r, c })}
                onClick={() => pick(r, c)}
              />
            )
          })}
        </div>
        <div className={styles.hint}>点击选择大小，或按 Esc 取消</div>
      </div>
    </div>
  )
}
