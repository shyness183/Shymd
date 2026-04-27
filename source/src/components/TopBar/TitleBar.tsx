import { useRef, useState, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { WindowControls } from './WindowControls'
import styles from './TitleBar.module.css'

/**
 * Top row of the redesigned chrome — slimmer after user feedback.
 *
 *   [☰][📁][🔍]                              [— ▢ ×]
 *
 * The current-file tab + `+ new file` button moved DOWN to row 2
 * (next to the kebab) per user request — keeps row 1 strictly for
 * window-level chrome.
 *
 * The whole bar is `data-tauri-drag-region` so the user can drag the
 * frameless window from anywhere except the buttons (which all set
 * `-webkit-app-region: no-drag` via their CSS).
 */
export function TitleBar() {
  const { t } = useLocale()
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)

  // Search popover (file-name filter, NOT find/replace inside the doc)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const [searchPos, setSearchPos] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openSearch = () => {
    if (!searchBtnRef.current) return
    const rect = searchBtnRef.current.getBoundingClientRect()
    setSearchPos({ x: rect.left, y: rect.bottom + 4 })
    if (!sidebarVisible) toggleSidebar()
    setActiveTab('files')
  }

  // Auto-focus the input when the popover opens.
  useEffect(() => {
    if (searchPos) inputRef.current?.focus()
  }, [searchPos])

  // Outside click → close popover.
  useEffect(() => {
    if (!searchPos) return
    const onDown = (e: MouseEvent) => {
      const tgt = e.target as Node
      if (
        searchBtnRef.current?.contains(tgt) ||
        inputRef.current?.contains(tgt) ||
        (tgt as Element)?.closest?.(`.${styles.searchPopover}`)
      ) return
      setSearchPos(null)
    }
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [searchPos])

  return (
    <div className={styles.titlebar} data-tauri-drag-region>
      {/* ── Left: chrome buttons ── */}
      <div className={styles.left}>
        <button
          className={`${styles.iconBtn}${sidebarVisible ? ' ' + styles.iconBtnActive : ''}`}
          onClick={toggleSidebar}
          title={t('menu.view.sidebar')}
          aria-label={t('menu.view.sidebar')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.2" />
            <line x1="6" y1="2.5" x2="6" y2="13.5" />
          </svg>
        </button>
        <button
          className={`${styles.iconBtn}${activeTab === 'files' && sidebarVisible ? ' ' + styles.iconBtnActive : ''}`}
          onClick={() => {
            setActiveTab('files')
            if (!sidebarVisible) toggleSidebar()
          }}
          title="文件"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1.5 4 L6 4 L7.5 5.5 L14.5 5.5 L14.5 13 L1.5 13 Z" />
          </svg>
        </button>
        <button
          ref={searchBtnRef}
          className={`${styles.iconBtn}${searchPos ? ' ' + styles.iconBtnActive : ''}`}
          onClick={openSearch}
          title="搜索文件"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.3" y1="10.3" x2="14" y2="14" />
          </svg>
        </button>
      </div>

      {/* Drag handle fills the empty middle so the user can grab anywhere */}
      <div className={styles.drag} data-tauri-drag-region />

      {/* ── Right: window controls only ── */}
      <div className={styles.right}>
        <WindowControls />
      </div>

      {/* Search popover — anchored under the [🔍] button, contains the
          single source of truth for the file-tree filter (store.searchQuery). */}
      {searchPos && (
        <div
          className={styles.searchPopover}
          style={{ left: searchPos.x, top: searchPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="搜索文件名…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('')
                setSearchPos(null)
              }
              if (e.key === 'Enter') setSearchPos(null)
            }}
          />
          {searchQuery && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              title="清空"
              aria-label="clear"
            >×</button>
          )}
        </div>
      )}
    </div>
  )
}
