/**
 * Saves and restores window position/size in Tauri desktop mode.
 * Uses localStorage for persistence across sessions.
 */
import { useEffect } from 'react'
import { isTauri } from '../lib/filesystem'

const STORAGE_KEY = 'shymd-window-state'

interface WindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

function loadState(): WindowState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveState(state: WindowState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useWindowState() {
  useEffect(() => {
    if (!isTauri()) return

    let cleanup: (() => void) | undefined

    ;(async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()

      // Restore saved state
      const saved = loadState()
      if (saved) {
        if (saved.maximized) {
          await win.maximize()
        } else {
          await win.setPosition(new (await import('@tauri-apps/api/dpi')).LogicalPosition(saved.x, saved.y))
          await win.setSize(new (await import('@tauri-apps/api/dpi')).LogicalSize(saved.width, saved.height))
        }
      }

      // Save state periodically on move/resize
      let saveTimer: number | undefined

      const debouncedSave = async () => {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = window.setTimeout(async () => {
          try {
            const maximized = await win.isMaximized()
            if (maximized) {
              saveState({ x: 0, y: 0, width: 0, height: 0, maximized: true })
            } else {
              const pos = await win.outerPosition()
              const size = await win.outerSize()
              saveState({
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                maximized: false,
              })
            }
          } catch {
            // ignore — window may be closing
          }
        }, 500)
      }

      const unlistenMove = await win.onMoved(debouncedSave)
      const unlistenResize = await win.onResized(debouncedSave)

      cleanup = () => {
        unlistenMove()
        unlistenResize()
        if (saveTimer) clearTimeout(saveTimer)
      }
    })()

    return () => cleanup?.()
  }, [])
}
