import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { newFile } from '../../lib/fileActions'
import { WindowControls } from './WindowControls'
import styles from './TitleBar.module.css'

/**
 * Top row of the redesigned chrome.
 *
 *   [☰][📁][🔍]   [filename ×][+]   [Mode ▾] [— ▢ ×]
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
  const activeFile = useAppStore((s) => s.activeFile)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const setFindOpen = useAppStore((s) => s.setFindOpen)

  const closeFile = () => {
    setActiveFile('', '', [], null)
  }

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
          className={styles.iconBtn}
          onClick={() => setFindOpen(true, 'find')}
          title={t('menu.edit.find')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.3" y1="10.3" x2="14" y2="14" />
          </svg>
        </button>
      </div>

      {/* ── Center: tab strip ── */}
      <div className={styles.tabs} data-tauri-drag-region>
        {activeFile && (
          <div className={`${styles.tab} ${styles.tabActive}`}>
            <span className={styles.tabName}>{activeFile}</span>
            <button
              className={styles.tabClose}
              onClick={closeFile}
              title="关闭"
              aria-label="close"
            >×</button>
          </div>
        )}
        <button
          className={styles.iconBtn}
          onClick={() => newFile()}
          title={t('menu.file.new')}
          aria-label={t('menu.file.new')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </button>
      </div>

      {/* ── Right: window controls only — the mode toggle lives in
           the second row (Toolbar) per user feedback. ── */}
      <div className={styles.right}>
        <WindowControls />
      </div>
    </div>
  )
}
