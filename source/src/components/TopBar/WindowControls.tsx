import { useEffect, useState } from 'react'
import styles from './WindowControls.module.css'

/**
 * Custom min / max-restore / close buttons for the frameless Tauri
 * window (`decorations: false` in tauri.conf.json). Buttons fall back
 * to a no-op outside Tauri so the dev server in a browser still
 * renders without throwing.
 */
export function WindowControls() {
  const [maximised, setMaximised] = useState(false)

  // Sync the max-restore icon with the actual window state.
  useEffect(() => {
    let unlistenFns: Array<() => void> = []
    let cancelled = false
    ;(async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        const isMax = await win.isMaximized()
        if (!cancelled) setMaximised(isMax)
        const un = await win.onResized(async () => {
          const m = await win.isMaximized()
          if (!cancelled) setMaximised(m)
        })
        unlistenFns.push(un)
      } catch {
        // Browser dev mode — just stay false
      }
    })()
    return () => {
      cancelled = true
      unlistenFns.forEach((f) => f())
    }
  }, [])

  const minimize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().minimize()
    } catch { /* no-op outside Tauri */ }
  }

  const toggleMax = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().toggleMaximize()
    } catch { /* no-op */ }
  }

  const close = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().close()
    } catch { /* no-op */ }
  }

  return (
    <div className={styles.controls}>
      <button className={styles.btn} onClick={minimize} title="最小化" aria-label="最小化">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect y="4.5" width="10" height="1" /></svg>
      </button>
      <button className={styles.btn} onClick={toggleMax} title={maximised ? '还原' : '最大化'} aria-label="最大化">
        {maximised ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="2.5" y="0.5" width="7" height="7" />
            <rect x="0.5" y="2.5" width="7" height="7" fill="var(--color-menu-bg, #fff)" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        )}
      </button>
      <button className={`${styles.btn} ${styles.close}`} onClick={close} title="关闭" aria-label="关闭">
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  )
}
