import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import {
  cmdHeading, cmdParagraph, cmdQuote, cmdCodeBlock, cmdMathBlock,
  cmdOrderedList, cmdUnorderedList,
  cmdBold, cmdItalic, cmdUnderline, cmdInlineCode, cmdInlineMath,
  cmdHyperlink, cmdImage, cmdFind, cmdReplace,
  getEditorView,
} from '../lib/editorCommands'
import {
  htmlBold, htmlItalic, htmlUnderline, htmlInlineCode,
  htmlHyperlink, htmlHeading, htmlParagraph, htmlQuote,
  htmlOrderedList, htmlUnorderedList, htmlCodeBlock,
  htmlImage, htmlInlineMath, htmlMathBlock,
  getCERoot, saveSelection,
} from '../lib/htmlEditorCommands'
import { saveMarkdown, saveMarkdownAs, openMarkdown, openFolder, newFile } from '../lib/fileActions'

export function useKeyboard() {
  // Read editorMode via getState() inside the handler to avoid
  // re-registering the keydown listener when the mode changes.
  // All other values (toggleSidebar, zoom*, etc.) are stable zustand
  // references read from the store at call time.
  useEffect(() => {
    const state = () => useAppStore.getState()
    const isWysiwygFocus = () => {
      if (state().editorMode !== 'wysiwyg') return false
      return !!getCERoot()
    }
    const hasSourceView = () => state().editorMode === 'source' && !!getEditorView()

    const bold = () => (isWysiwygFocus() ? htmlBold() : hasSourceView() && cmdBold())
    const italic = () => (isWysiwygFocus() ? htmlItalic() : hasSourceView() && cmdItalic())
    const underline = () => (isWysiwygFocus() ? htmlUnderline() : hasSourceView() && cmdUnderline())
    const inlineCode = () => (isWysiwygFocus() ? htmlInlineCode() : hasSourceView() && cmdInlineCode())
    const hyperlink = () => (isWysiwygFocus() ? htmlHyperlink() : hasSourceView() && cmdHyperlink())
    const heading = (l: number) => (isWysiwygFocus() ? htmlHeading(l) : hasSourceView() && cmdHeading(l))
    const paragraph = () => (isWysiwygFocus() ? htmlParagraph() : hasSourceView() && cmdParagraph())
    const quote = () => (isWysiwygFocus() ? htmlQuote() : hasSourceView() && cmdQuote())
    const ol = () => (isWysiwygFocus() ? htmlOrderedList() : hasSourceView() && cmdOrderedList())
    const ul = () => (isWysiwygFocus() ? htmlUnorderedList() : hasSourceView() && cmdUnorderedList())
    const codeBlock = () => (isWysiwygFocus() ? htmlCodeBlock() : hasSourceView() && cmdCodeBlock())

    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey

      // ── Global UI shortcuts ──
      if (mod && e.key === '\\' && !e.shiftKey) {
        e.preventDefault(); state().toggleSidebar(); return
      }
      if (mod && e.key === '/') {
        e.preventDefault()
        const curMode = state().editorMode
        state().setEditorMode(curMode === 'source' ? 'wysiwyg' : 'source'); return
      }
      if (e.key === 'F11') {
        e.preventDefault(); state().toggleFocusMode(); return
      }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault(); state().zoomIn(); return
      }
      if (mod && e.key === '-') {
        e.preventDefault(); state().zoomOut(); return
      }
      if (mod && e.key === ',') {
        e.preventDefault(); state().setSettingsOpen(true); return
      }

      // ── File shortcuts ──
      if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault(); newFile(); return
      }
      if (mod && e.key.toLowerCase() === 'o' && e.shiftKey) {
        e.preventDefault(); openFolder(); return
      }
      if (mod && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault(); openMarkdown(); return
      }
      if (mod && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault(); saveMarkdownAs(); return
      }
      if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault(); saveMarkdown(); return
      }

      // ── Edit shortcuts ──
      if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault()
        if (hasSourceView()) cmdFind()
        else useAppStore.getState().setFindOpen(true, 'find')
        return
      }
      if (mod && e.key.toLowerCase() === 'h' && !e.shiftKey) {
        e.preventDefault()
        if (hasSourceView()) cmdReplace()
        else useAppStore.getState().setFindOpen(true, 'replace')
        return
      }
      // Copy as Markdown (Ctrl+Shift+C)
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        const doc = useAppStore.getState().doc
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed && isWysiwygFocus()) {
          // Convert selected HTML to markdown (lazy-load turndown).
          const range = sel.getRangeAt(0)
          const div = document.createElement('div')
          div.appendChild(range.cloneContents())
          import('turndown').then(({ default: T }) => {
            const td = new T({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
            navigator.clipboard.writeText(td.turndown(div.innerHTML))
          })
          return
        }
        // Source mode: copy full document markdown.  In WYSIWYG mode with
        // no selection, don't silently copy the entire document — the user
        // likely pressed the shortcut unintentionally.
        if (hasSourceView()) {
          navigator.clipboard.writeText(doc)
        }
        return
      }
      // Paste as plain text (Ctrl+Shift+V)
      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then((text) => {
          document.execCommand('insertText', false, text)
        })
        return
      }

      // ── Paragraph shortcuts ──
      if (mod && e.key === '0' && !e.shiftKey) {
        e.preventDefault(); paragraph(); return
      }
      if (mod && !e.shiftKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault(); heading(Number(e.key)); return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault(); quote(); return
      }
      if (mod && e.shiftKey && e.key === '[') {
        e.preventDefault(); ol(); return
      }
      if (mod && e.shiftKey && e.key === ']') {
        e.preventDefault(); ul(); return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault(); codeBlock(); return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        if (isWysiwygFocus()) htmlMathBlock()
        else if (hasSourceView()) cmdMathBlock()
        return
      }
      if (mod && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        if (isWysiwygFocus()) saveSelection()
        useAppStore.getState().setTablePickerOpen(true)
        return
      }

      // ── Format shortcuts ──
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault(); bold(); return
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault(); italic(); return
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault(); underline(); return
      }
      if (mod && !e.shiftKey && e.key === '`') {
        e.preventDefault(); inlineCode(); return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        if (isWysiwygFocus()) htmlInlineMath()
        else if (hasSourceView()) cmdInlineMath()
        return
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault(); hyperlink(); return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        if (isWysiwygFocus()) htmlImage()
        else if (hasSourceView()) cmdImage()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
