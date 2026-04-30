import { useEffect, useRef } from 'react'
import { useLinkDialogStore, commitLinkDialog } from '../../lib/linkDialog'
import styles from './LinkDialog.module.css'

export function LinkDialog() {
  const { open, text, url } = useLinkDialogStore()
  const textRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    // Set values and focus URL field
    if (textRef.current) textRef.current.value = text
    if (urlRef.current) {
      urlRef.current.value = url
      setTimeout(() => urlRef.current?.select(), 30)
    }
  }, [open, text, url])

  if (!open) return null

  const DANGEROUS = /^(javascript|data|vbscript|blob):/i
  const confirm = () => {
    const t = textRef.current?.value.trim() ?? ''
    const u = (urlRef.current?.value ?? '').trim()
    if (!u) { urlRef.current?.focus(); return }
    if (DANGEROUS.test(u)) {
      urlRef.current?.focus()
      urlRef.current?.select()
      return
    }
    commitLinkDialog({ text: t, url: u })
  }

  const cancel = () => commitLinkDialog(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirm()
    if (e.key === 'Escape') cancel()
  }

  return (
    <div className={styles.backdrop} onMouseDown={cancel}>
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.title}>插入链接</div>

        <label className={styles.label}>链接文字</label>
        <input
          ref={textRef}
          className={styles.input}
          placeholder="显示文字（可留空）"
          onKeyDown={onKeyDown}
        />

        <label className={styles.label}>链接地址</label>
        <input
          ref={urlRef}
          className={styles.input}
          placeholder="https://"
          onKeyDown={onKeyDown}
        />

        <div className={styles.buttons}>
          <button className={styles.btnCancel} onClick={cancel}>取消</button>
          <button className={styles.btnConfirm} onClick={confirm}>确认</button>
        </div>
      </div>
    </div>
  )
}
