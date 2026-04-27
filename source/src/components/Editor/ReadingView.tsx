import { useMemo, useEffect, useRef } from 'react'
import { md, renderMermaidBlocks, injectTOC, resolveRelativeAssets } from '../../lib/markdown'
import { useAppStore } from '../../stores/useAppStore'
import styles from './Editor.module.css'

export function ReadingView() {
  const doc = useAppStore((s) => s.doc)
  const activeAbsolutePath = useAppStore((s) => s.activeAbsolutePath)
  const html = useMemo(() => md.render(doc), [doc])
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    injectTOC(el)
    renderMermaidBlocks(el)
    resolveRelativeAssets(el, activeAbsolutePath)
  }, [html, activeAbsolutePath])

  // In reading mode, clicks on links open in browser/system
  const onClick = (e: React.MouseEvent) => {
    let node: Node | null = e.target as Node
    while (node && node !== contentRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'A') {
        const href = (node as HTMLAnchorElement).href
        if (href) {
          e.preventDefault()
          openExternal(href)
        }
        return
      }
      node = node.parentNode
    }
  }

  // Open URL in system browser (Tauri) or new tab (browser)
  const openExternal = async (url: string) => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(url)
        return
      } catch (err) {
        console.error('Failed to open URL via Tauri opener:', err)
      }
    }
    window.open(url, '_blank')
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
