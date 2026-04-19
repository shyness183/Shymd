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

  // In reading mode, clicks on links open in browser/system
  const onClick = (e: React.MouseEvent) => {
    let node: Node | null = e.target as Node
    while (node && node !== contentRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'A') {
        const href = (node as HTMLAnchorElement).href
        if (href) {
          e.preventDefault()
          window.open(href, '_blank')
        }
        return
      }
      node = node.parentNode
    }
  }

  return (
    <div className={styles.editor}>
      <div
        ref={contentRef}
        className={styles.content}
        data-find-root="true"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={onClick}
      />
    </div>
  )
}
