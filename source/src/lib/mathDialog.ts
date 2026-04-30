import { create } from 'zustand'

export type MathDialogResult = { tex: string; display: boolean } | null

interface MathDialogState {
  open: boolean
  /** Initial LaTeX shown in the textarea on open. */
  initialTex: string
  /** Whether the caller wants a block ($$…$$) or inline ($…$) formula. */
  initialDisplay: boolean
  _show: (tex: string, display: boolean) => void
  _hide: () => void
}

export const useMathDialogStore = create<MathDialogState>((set) => ({
  open: false,
  initialTex: '',
  initialDisplay: false,
  _show: (tex, display) => set({ open: true, initialTex: tex, initialDisplay: display }),
  _hide: () => set({ open: false }),
}))

let _resolve: ((r: MathDialogResult) => void) | null = null

/**
 * Open the math dialog. Resolves with the LaTeX + block/inline choice,
 * or `null` if the user cancels.
 *
 * The dialog supports BOTH forms on open: caller sets the initial toggle
 * state, but the user can flip it inside the dialog before confirming.
 */
export function showMathDialog(
  tex = '',
  display = false,
): Promise<MathDialogResult> {
  return new Promise((resolve) => {
    // If a previous call is still pending (e.g., user hit Ctrl+Shift+E
    // twice), settle it with null so the earlier Promise doesn't leak.
    if (_resolve) _resolve(null)
    _resolve = resolve
    useMathDialogStore.getState()._show(tex, display)
  })
}

/** Called by the dialog component when the user confirms or cancels. */
export function commitMathDialog(result: MathDialogResult) {
  useMathDialogStore.getState()._hide()
  _resolve?.(result)
  _resolve = null
  // Restore editor focus so the user can keep typing without clicking back.
  setTimeout(async () => {
    const { getCERoot } = await import('./htmlEditorCommands')
    const { getEditorView } = await import('./editorCommands')
    const root = getCERoot()
    if (root) { root.focus(); return }
    const view = getEditorView()
    view?.focus()
  }, 0)
}
