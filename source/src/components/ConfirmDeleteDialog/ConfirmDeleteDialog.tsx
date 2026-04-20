import { useEffect, useRef } from 'react'
import { useDeleteDialogStore, commitDeleteDialog } from '../../lib/confirmDeleteDialog'
import { useLocale } from '../../hooks/useLocale'
import styles from './ConfirmDeleteDialog.module.css'

export function ConfirmDeleteDialog() {
  const { t } = useLocale()
  const { open, options } = useDeleteDialogStore()
  const defaultBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Autofocus the default (safe) action so Enter picks "keep local files"
    setTimeout(() => defaultBtnRef.current?.focus(), 30)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        commitDeleteDialog('cancel')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !options) return null

  const { name, isFolder, count } = options
  const multi = (count ?? 1) > 1

  const title = multi
    ? `${t('deleteDialog.titleMulti')} ${count} ${t('deleteDialog.items')}`
    : `${t('deleteDialog.title')} "${name}"`

  // Body text differs between folder (mentions "内部文件") and file.
  const body = isFolder || multi
    ? t('deleteDialog.bodyFolder')
    : t('deleteDialog.bodyFile')

  return (
    <div className={styles.backdrop} onMouseDown={() => commitDeleteDialog('cancel')}>
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <div className={styles.body}>{body}</div>

        <ul className={styles.options}>
          <li>
            <strong>{t('deleteDialog.softLabel')}</strong>
            <span className={styles.optDesc}>{t('deleteDialog.softHint')}</span>
          </li>
          <li>
            <strong>{t('deleteDialog.hardLabel')}</strong>
            <span className={styles.optDesc}>{t('deleteDialog.hardHint')}</span>
          </li>
        </ul>

        <div className={styles.buttons}>
          <button
            className={styles.btnCancel}
            onClick={() => commitDeleteDialog('cancel')}
          >
            {t('deleteDialog.cancel')}
          </button>
          <button
            className={styles.btnDanger}
            onClick={() => commitDeleteDialog('hard')}
          >
            {t('deleteDialog.hardLabel')}
          </button>
          <button
            ref={defaultBtnRef}
            className={styles.btnPrimary}
            onClick={() => commitDeleteDialog('soft')}
          >
            {t('deleteDialog.softLabel')}
          </button>
        </div>

        <div className={styles.defaultHint}>{t('deleteDialog.defaultHint')}</div>
      </div>
    </div>
  )
}
