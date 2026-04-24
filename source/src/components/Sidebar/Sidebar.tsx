import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { SidebarTabs } from './SidebarTabs'
import { SearchBox } from './SearchBox'
import { FileTree } from './FileTree'
import { OutlineTree } from './OutlineTree'
import styles from './Sidebar.module.css'

const SCROLL_EDGE = 40   // px from edge to start auto-scroll
const SCROLL_SPEED = 8   // px per frame

/** Truncate a long path for display: keep first segment + "..." + last 2 segments. */
function truncatePath(full: string): string {
  if (!full) return ''
  const parts = full.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 3) return full
  return [parts[0], '…', parts[parts.length - 2], parts[parts.length - 1]].join('\\')
}

export function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const fileStoragePath = useAppStore((s) => s.settings.fileStoragePath)
  const [filter, setFilter] = useState('')
  const dragging = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number>(0)

  // ── Auto-scroll during drag near top/bottom edges ──
  const onContentDragOver = useCallback((e: React.DragEvent) => {
    const el = contentRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const y = e.clientY

    let direction = 0
    if (y - rect.top < SCROLL_EDGE) direction = -1      // near top → scroll up
    else if (rect.bottom - y < SCROLL_EDGE) direction = 1 // near bottom → scroll down

    if (direction !== 0 && !scrollRafRef.current) {
      const tick = () => {
        el.scrollBy(0, direction * SCROLL_SPEED)
        scrollRafRef.current = requestAnimationFrame(tick)
      }
      scrollRafRef.current = requestAnimationFrame(tick)
    } else if (direction === 0 && scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
  }, [])

  // Clean up on unmount
  useEffect(() => stopAutoScroll, [stopAutoScroll])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMouseMove = (ev: MouseEvent) => {
        if (dragging.current) {
          setSidebarWidth(ev.clientX)
        }
      }

      const onMouseUp = () => {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [setSidebarWidth]
  )

  return (
    <div className={styles.sidebar}>
      <SidebarTabs />
      {activeTab === 'files' && fileStoragePath && (
        <div className={styles.pathHeader} title={fileStoragePath}>
          📁 {truncatePath(fileStoragePath)}
        </div>
      )}
      <SearchBox value={filter} onChange={setFilter} />
      <div
        ref={contentRef}
        className={styles.content}
        onDragOver={onContentDragOver}
        onDragLeave={stopAutoScroll}
        onDrop={stopAutoScroll}
        onDragEnd={stopAutoScroll}
      >
        {activeTab === 'files' ? <FileTree filter={filter} /> : <OutlineTree filter={filter} />}
      </div>
      <SidebarFooter />
      <div
        className={styles.resizeHandle}
        onMouseDown={onMouseDown}
      />
    </div>
  )
}

/**
 * Bottom-left gear button — opens the settings modal. Matches the
 * Notion / VSCode convention of a persistent settings entry point
 * at the bottom of the sidebar, independent of the File menu path.
 */
function SidebarFooter() {
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const { t } = useLocale()
  return (
    <div className={styles.footer}>
      <button
        type="button"
        className={styles.footerBtn}
        title={t('menu.file.preferences')}
        onClick={() => setSettingsOpen(true)}
        aria-label={t('menu.file.preferences')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
