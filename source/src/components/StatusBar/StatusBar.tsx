import { useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import styles from './StatusBar.module.css'

export function StatusBar() {
  const { t } = useLocale()
  const doc = useAppStore((s) => s.doc)
  const editorMode = useAppStore((s) => s.editorMode)

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
        <span className={styles.mode}>{modeLabel}</span>
      </div>
    </div>
  )
}
