import { useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import type { EditorMode } from '../../types'
import styles from './StatusBar.module.css'

// Cycle order shown to the user when they click the mode pill.
// Matches the Ctrl+/ behaviour in useKeyboard so there is exactly
// one "next mode" contract in the app.
const MODE_CYCLE: EditorMode[] = ['wysiwyg', 'source', 'reading']

export function StatusBar() {
  const { t } = useLocale()
  const doc = useAppStore((s) => s.doc)
  const lastSavedDoc = useAppStore((s) => s.lastSavedDoc)
  const activeFile = useAppStore((s) => s.activeFile)
  const editorMode = useAppStore((s) => s.editorMode)
  const setEditorMode = useAppStore((s) => s.setEditorMode)
  const dirty = doc !== lastSavedDoc

  const cycleMode = () => {
    const i = MODE_CYCLE.indexOf(editorMode)
    const next = MODE_CYCLE[(i + 1) % MODE_CYCLE.length]
    setEditorMode(next)
  }

  const stats = useMemo(() => {
    const text = doc.trim()
    const chars = text.replace(/\s/g, '').length
    const lines = text ? text.split('\n').length : 0
    const words = chars
    const readMin = Math.max(1, Math.round(chars / 500))
    return { words, lines, readMin }
  }, [doc])

  const modeLabel = editorMode === 'source'
    ? t('menu.view.sourceMode')
    : editorMode === 'reading'
      ? t('menu.view.readingMode')
      : t('menu.view.wysiwyg')

  return (
    <div className={styles.statusbar}>
      <div className={styles.left}>
        <span className={styles.item}>{t('status.words')} {stats.words.toLocaleString()}</span>
        <span className={styles.item}>{t('status.lines')} {stats.lines}</span>
        <span className={styles.item}>{t('status.readTime', { min: String(stats.readMin) })}</span>
      </div>
      <div className={styles.right}>
        {activeFile && (
          <span className={dirty ? styles.dirty : styles.saved}>
            {dirty ? `● ${t('status.unsaved')}` : `✓ ${t('status.saved')}`}
          </span>
        )}
        <button
          type="button"
          className={styles.mode}
          onClick={cycleMode}
          title={t('status.clickToCycleMode')}
        >
          {modeLabel}
        </button>
      </div>
    </div>
  )
}
