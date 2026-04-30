import { create } from 'zustand'

export type DeleteChoice = 'cancel' | 'soft' | 'hard'

export interface DeleteDialogOptions {
  /** Display name of the node being deleted. */
  name: string
  /** Whether the target is a folder (affects wording). */
  isFolder: boolean
  /** Optional count when deleting multiple nodes at once. */
  count?: number
}

interface DeleteDialogState {
  open: boolean
  options: DeleteDialogOptions | null
  _show: (opts: DeleteDialogOptions) => void
  _hide: () => void
}

export const useDeleteDialogStore = create<DeleteDialogState>((set) => ({
  open: false,
  options: null,
  _show: (options) => set({ open: true, options }),
  _hide: () => set({ open: false, options: null }),
}))

let _resolve: ((r: DeleteChoice) => void) | null = null

/**
 * Show the three-option delete confirm dialog. Resolves with the user's
 * choice:
 *   - 'soft'   → remove from sidebar, keep files on disk
 *   - 'hard'   → remove from sidebar AND delete from disk
 *   - 'cancel' → user cancelled
 */
export function showDeleteDialog(opts: DeleteDialogOptions): Promise<DeleteChoice> {
  // If a dialog is already showing, resolve the previous one as cancelled
  // so its promise doesn't leak unresolved.
  if (_resolve) {
    const prev = _resolve
    _resolve = null
    prev('cancel')
  }
  return new Promise((resolve) => {
    _resolve = resolve
    useDeleteDialogStore.getState()._show(opts)
  })
}

/** Called by the dialog component when the user picks a button. */
export function commitDeleteDialog(choice: DeleteChoice) {
  useDeleteDialogStore.getState()._hide()
  _resolve?.(choice)
  _resolve = null
  // Restore editor focus so the user can keep typing without clicking back.
  import('./htmlEditorCommands').then(({ restoreEditorFocus }) => restoreEditorFocus())
}
