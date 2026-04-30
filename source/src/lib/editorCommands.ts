import { undo, redo, selectAll } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'

// Global ref to the active CodeMirror EditorView
let _editorView: EditorView | null = null

export function setEditorView(view: EditorView | null) {
  _editorView = view
}

export function getEditorView(): EditorView | null {
  return _editorView
}

// Wrap/unwrap selection with prefix/suffix (toggle, e.g., **bold**)
function wrapSelection(view: EditorView, prefix: string, suffix: string = prefix) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  // Case 1: selected text itself starts/ends with prefix/suffix → unwrap inside
  if (
    selected.length >= prefix.length + suffix.length &&
    selected.startsWith(prefix) &&
    selected.endsWith(suffix)
  ) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length)
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    })
    view.focus()
    return
  }

  // Case 2: text around selection already has the wrapper → unwrap outside
  const before = view.state.sliceDoc(Math.max(0, from - prefix.length), from)
  const after = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + suffix.length))
  if (before === prefix && after === suffix) {
    view.dispatch({
      changes: [
        { from: from - prefix.length, to: from, insert: '' },
        { from: to, to: to + suffix.length, insert: '' },
      ],
      selection: { anchor: from - prefix.length, head: to - prefix.length },
    })
    view.focus()
    return
  }

  // Case 3: wrap selection — do nothing when nothing is selected
  if (!selected) { view.focus(); return }
  view.dispatch({
    changes: { from, to, insert: `${prefix}${selected}${suffix}` },
    selection: { anchor: from + prefix.length, head: from + prefix.length + selected.length },
  })
  view.focus()
}

// Insert text at cursor, replacing current line prefix if needed
function setLinePrefix(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const lineText = line.text
  // Remove existing heading/list prefix
  const cleaned = lineText.replace(/^(#{1,6}\s+|>\s*|- \[[ x]\]\s*|- |\d+\.\s+|\s*)/, '')
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: prefix + cleaned },
    selection: { anchor: line.from + prefix.length + cleaned.length },
  })
  view.focus()
}

// Insert a block of text at cursor position (on a new line)
function insertBlock(view: EditorView, block: string) {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const insertAt = line.to
  const newline = line.text.length > 0 ? '\n\n' : '\n'
  view.dispatch({
    changes: { from: insertAt, insert: newline + block },
    selection: { anchor: insertAt + newline.length + block.length },
  })
  view.focus()
}

// --- Paragraph commands ---

export function cmdHeading(level: number) {
  const view = _editorView
  if (!view) return
  const prefix = '#'.repeat(level) + ' '
  setLinePrefix(view, prefix)
}

export function cmdParagraph() {
  const view = _editorView
  if (!view) return
  setLinePrefix(view, '')
}

export function cmdQuote() {
  const view = _editorView
  if (!view) return
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  if (line.text.startsWith('> ')) {
    setLinePrefix(view, '')
  } else {
    setLinePrefix(view, '> ')
  }
}

export function cmdUnorderedList() {
  const view = _editorView
  if (!view) return
  setLinePrefix(view, '- ')
}

export function cmdOrderedList() {
  const view = _editorView
  if (!view) return
  setLinePrefix(view, '1. ')
}

export function cmdTaskList() {
  const view = _editorView
  if (!view) return
  setLinePrefix(view, '- [ ] ')
}

export function cmdCodeBlock() {
  const view = _editorView
  if (!view) return
  insertBlock(view, '```\n\n```')
  // Move cursor inside the code block (between the opening ``` fence
  // and the closing ```).  The cursor is at the end of the block; step
  // back past the closing fence + its leading newline.
  const { from } = view.state.selection.main
  const CLOSING = '```'
  view.dispatch({ selection: { anchor: from - (CLOSING.length + 1) } })
}

export async function cmdMathBlock() {
  const view = _editorView
  if (!view) return
  const { from, to } = view.state.selection.main
  const seed = view.state.sliceDoc(from, to) || '\\int_0^1 x^2\\,dx'
  // Snapshot which file we're editing — if the user switches files while
  // the dialog is open, discard the result instead of corrupting another doc.
  const { useAppStore } = await import('../stores/useAppStore')
  const fileKey = useAppStore.getState().activeFilePath.join('/')
  const { showMathDialog } = await import('./mathDialog')
  const result = await showMathDialog(seed, /* display */ true)
  if (!result) { view.focus(); return }
  if (useAppStore.getState().activeFilePath.join('/') !== fileKey) {
    view.focus(); return
  }
  const snippet = result.display
    ? `\n$$\n${result.tex}\n$$\n`
    : `$${result.tex}$`
  view.dispatch({
    changes: { from, to, insert: snippet },
    selection: { anchor: from + snippet.length },
  })
  view.focus()
}

export function cmdHorizontalRule() {
  const view = _editorView
  if (!view) return
  insertBlock(view, '---')
}

export function cmdTable(rows = 1, cols = 3) {
  const view = _editorView
  if (!view) return
  const header = '| ' + Array.from({ length: cols }, (_, i) => `列 ${i + 1}`).join(' | ') + ' |'
  const sep = '|' + ' --- |'.repeat(cols)
  const body = Array.from({ length: rows }, () =>
    '|' + '     |'.repeat(cols),
  ).join('\n')
  insertBlock(view, `${header}\n${sep}\n${body}`)
}

// --- Format commands ---

export function cmdBold() {
  const view = _editorView
  if (!view) return
  wrapSelection(view, '**')
}

export function cmdItalic() {
  const view = _editorView
  if (!view) return
  wrapSelection(view, '*')
}

export function cmdUnderline() {
  const view = _editorView
  if (!view) return
  wrapSelection(view, '<u>', '</u>')
}

export function cmdStrikethrough() {
  const view = _editorView
  if (!view) return
  wrapSelection(view, '~~')
}

export function cmdInlineCode() {
  const view = _editorView
  if (!view) return
  wrapSelection(view, '`')
}

export async function cmdInlineMath() {
  const view = _editorView
  if (!view) return
  const { from, to } = view.state.selection.main
  const seed = view.state.sliceDoc(from, to)
  const { useAppStore } = await import('../stores/useAppStore')
  const fileKey = useAppStore.getState().activeFilePath.join('/')
  const { showMathDialog } = await import('./mathDialog')
  const result = await showMathDialog(seed, /* display */ false)
  if (!result) { view.focus(); return }
  if (useAppStore.getState().activeFilePath.join('/') !== fileKey) {
    view.focus(); return
  }
  const snippet = result.display
    ? `\n$$\n${result.tex}\n$$\n`
    : `$${result.tex}$`
  view.dispatch({
    changes: { from, to, insert: snippet },
    selection: { anchor: from + snippet.length },
  })
  view.focus()
}

export function cmdHighlight() {
  const view = _editorView
  if (!view) return
  wrapSelection(view, '==')
}

export async function cmdHyperlink() {
  const view = _editorView
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  const { useAppStore } = await import('../stores/useAppStore')
  const fileKey = useAppStore.getState().activeFilePath.join('/')
  const { showLinkDialog } = await import('./linkDialog')
  const result = await showLinkDialog(selected || '', '')
  if (!result) { view.focus(); return }
  if (useAppStore.getState().activeFilePath.join('/') !== fileKey) {
    view.focus(); return
  }

  const replacement = `[${result.text || result.url}](${result.url})`
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + replacement.length },
  })
  view.focus()
}

export async function cmdImage() {
  const view = _editorView
  if (!view) return

  const { useAppStore } = await import('../stores/useAppStore')
  const fileKey = useAppStore.getState().activeFilePath.join('/')

  if ((window as any).__TAURI_INTERNALS__) {
    const dialog = await import('@tauri-apps/plugin-dialog')
    const result = await dialog.open({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'] }],
      multiple: false,
    })
    const filePath = typeof result === 'string' ? result : (result as any)?.path ?? null
    if (!filePath) { view.focus(); return }
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    const { useAppStore } = await import('../stores/useAppStore')
    const cache = useAppStore.getState().settings.cachePath
    let url: string
    if (cache) {
      try {
        const { copyFile, createDir, pathExists } = await import('./filesystem')
        if (!(await pathExists(cache))) await createDir(cache)
        const base = filePath.split(/[\\/]/).pop() || 'image'
        const stamp = Date.now().toString(36)
        const cached = `${cache.replace(/[\\/]+$/, '')}/${stamp}_${base}`
        await copyFile(filePath, cached)
        url = convertFileSrc(cached)
      } catch (err) {
        console.error('Failed to cache image, using original path:', err)
        url = convertFileSrc(filePath)
      }
    } else {
      url = convertFileSrc(filePath)
    }
    if (useAppStore.getState().activeFilePath.join('/') !== fileKey) {
      view.focus(); return
    }
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const replacement = `![${selected || 'image'}](${url})`
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + replacement.length },
    })
    view.focus()
  } else {
    const { pickImageBrowser } = await import('./filesystem')
    const url = await pickImageBrowser()
    if (!url) { view.focus(); return }
    if (useAppStore.getState().activeFilePath.join('/') !== fileKey) {
      view.focus(); return
    }
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const replacement = `![${selected || 'image'}](${url})`
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + replacement.length },
    })
    view.focus()
  }
}

/**
 * Strip markdown decorators from the current selection in source mode.
 *
 * We deliberately only handle INLINE wrappers (bold / italic / strike /
 * highlight / inline-code / inline-math / underline-html). Removing a
 * heading or list prefix belongs in cmdParagraph; this command keeps its
 * scope small and predictable so users don't lose block structure by
 * accident.
 */
export function cmdClearFormat() {
  const view = _editorView
  if (!view) return
  const { from, to } = view.state.selection.main
  if (from === to) return
  let text = view.state.sliceDoc(from, to)
  // Strip pair-wrapped inline markers iteratively until nothing changes,
  // so **_foo_** collapses cleanly.
  //
  // Safari < 16.4 does not support lookbehind (?<!…).  Build the italic
  // regexes with the RegExp constructor so a SyntaxError is catchable at
  // runtime (regex literals throw at parse time and are uncatchable).
  let italicStarRe: RegExp
  let italicUnderscoreRe: RegExp
  try {
    italicStarRe = new RegExp('(?<!\\*)\\*([^*\\n]+?)\\*(?!\\*)', 'g')
    italicUnderscoreRe = new RegExp('(?<!_)_([^_\\n]+?)_(?!_)', 'g')
  } catch {
    // Fall back to simpler patterns without negative lookbehind.
    italicStarRe = /\*([^*\n]+?)\*/g
    italicUnderscoreRe = /_([^_\n]+?)_/g
  }

  let prev: string
  do {
    prev = text
    text = text
      .replace(/<\/?u>/gi, '')               // <u>...</u>
      .replace(/<\/?mark[^>]*>/gi, '')       // <mark>...</mark>
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')  // bold
      .replace(/__([\s\S]+?)__/g, '$1')      // alt bold
      .replace(italicStarRe, '$1')            // italic *
      .replace(italicUnderscoreRe, '$1')      // italic _
      .replace(/~~([\s\S]+?)~~/g, '$1')      // strikethrough
      .replace(/==([\s\S]+?)==/g, '$1')      // highlight
      .replace(/`([^`\n]+)`/g, '$1')         // inline code
      .replace(/\$([^$\n]+)\$/g, '$1')       // inline math
  } while (text !== prev)
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from, head: from + text.length },
  })
  view.focus()
}

// --- Edit commands (mode-aware) ---
// These exist because document.execCommand('undo'/'redo'/'selectAll')
// is broken inside CodeMirror 6 which manages its own history/selection.
// The WYSIWYG path still delegates to execCommand where it works fine.

export function cmdUndo() {
  const view = _editorView
  if (!view) return
  undo(view)
}

export function cmdRedo() {
  const view = _editorView
  if (!view) return
  redo(view)
}

export function cmdSelectAll() {
  const view = _editorView
  if (!view) return
  selectAll(view)
}

export function cmdCut() {
  const view = _editorView
  if (!view) return
  document.execCommand('cut')
}

export function cmdCopy() {
  const view = _editorView
  if (!view) return
  document.execCommand('copy')
}

export function cmdPaste() {
  const view = _editorView
  if (!view) return
  document.execCommand('paste')
}

// --- Search commands ---

export function cmdFind() {
  const view = _editorView
  if (!view) return
  // Trigger CodeMirror's built-in search
  import('@codemirror/search').then(({ openSearchPanel }) => {
    openSearchPanel(view)
  })
}

export function cmdReplace() {
  const view = _editorView
  if (!view) return
  import('@codemirror/search').then(({ openSearchPanel }) => {
    openSearchPanel(view)
  })
}
