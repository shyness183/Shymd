import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { isTauri } from '../lib/filesystem'

/**
 * Handles "Set as default app" flow:
 *
 * - On startup, ask the Rust side for the .md path argv[1] (if any) and
 *   open it. This fires when the user double-clicks a .md in Explorer
 *   with Shymd as the default handler.
 * - Listen for subsequent `open-external-file` events emitted by the
 *   single-instance plugin: when the user double-clicks ANOTHER .md while
 *   Shymd is already running, argv is forwarded here so we can switch to
 *   it instead of spawning a second window.
 */
export function useLaunchFile() {
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | null = null
    ;(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const { listen } = await import('@tauri-apps/api/event')

        // 1) Handle the file we were launched with.
        const initial = await invoke<string | null>('get_launch_file')
        if (initial) {
          await useAppStore.getState().openFileByAbsolutePath(initial)
        }

        // 2) Handle subsequent double-clicks forwarded by single-instance.
        unlisten = await listen<string>('open-external-file', (e) => {
          const path = e.payload
          if (typeof path === 'string' && path) {
            void useAppStore.getState().openFileByAbsolutePath(path)
          }
        })
      } catch (err) {
        console.error('useLaunchFile setup failed:', err)
      }
    })()
    return () => {
      if (unlisten) unlisten()
    }
  }, [])
}
