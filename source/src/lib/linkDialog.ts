import { create } from 'zustand'

export type LinkDialogResult = { text: string; url: string } | null

interface LinkDialogState {
  open: boolean
  text: string
  url: string
  _show: (text: string, url: string) => void
  _hide: () => void
}

export const useLinkDialogStore = create<LinkDialogState>((set) => ({
  open: false,
  text: '',
  url: '',
  _show: (text, url) => set({ open: true, text, url }),
  _hide: () => set({ open: false }),
}))

let _resolve: ((r: LinkDialogResult) => void) | null = null

/** Open the custom link dialog. Returns { text, url } or null if cancelled. */
export function showLinkDialog(text = '', url = ''): Promise<LinkDialogResult> {
  // If a dialog is already showing, resolve the previous one as cancelled
  // so its promise doesn't leak unresolved.
  if (_resolve) {
    const prev = _resolve
    _resolve = null
    prev(null)
  }
  return new Promise((resolve) => {
    _resolve = resolve
    useLinkDialogStore.getState()._show(text, url)
  })
}

/** Called by the dialog component when the user confirms or cancels. */
export function commitLinkDialog(result: LinkDialogResult) {
  useLinkDialogStore.getState()._hide()
  _resolve?.(result)
  _resolve = null
  // Restore editor focus so the user can keep typing without clicking back.
  import('./htmlEditorCommands').then(({ restoreEditorFocus }) => restoreEditorFocus())
}
