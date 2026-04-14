import { useMemo, useEffect, useRef } from 'react'
import { md, renderMermaidBlocks, injectTOC } from '../../lib/markdown'
import { useAppStore } from '../../stores/useAppStore'
import styles from './Editor.module.css'

export function ReadingView() {
  const doc = useAppStore((s) => s.doc)
  const html = useMemo(() => md.render(doc), [doc])
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    injectTOC(el)
    renderMermaidBlocks(el)
  }, [html])

  return (
    <div className={styles.editor}>
      <div
        ref={contentRef}
        className={styles.content}
        data-find-root="true"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
