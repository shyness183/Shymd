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
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const editorMode = useAppStore((s) => s.editorMode)
  const setEditorMode = useAppStore((s) => s.setEditorMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const zoomIn = useAppStore((s) => s.zoomIn)
  const zoomOut = useAppStore((s) => s.zoomOut)
  const zoomReset = useAppStore((s) => s.zoomReset)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)

  useEffect(() => {
    const isWysiwygFocus = () => {
      if (editorMode !== 'wysiwyg') return false
      return !!getCERoot()
    }
    const hasSourceView = () => editorMode === 'source' && !!getEditorView()

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
        e.preventDefault(); toggleSidebar(); return
      }
      if (mod && e.key === '/') {
        e.preventDefault()
        setEditorMode(editorMode === 'source' ? 'wysiwyg' : 'source'); return
      }
      if (e.key === 'F11') {
        e.preventDefault(); toggleFocusMode(); return
      }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault(); zoomIn(); return
      }
      if (mod && e.key === '-') {
        e.preventDefault(); zoomOut(); return
      }
      if (mod && e.key === ',') {
        e.preventDefault(); setSettingsOpen(true); return
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
          // In WYSIWYG: convert selected HTML back to markdown
          const TurndownService = (window as any).__turndown
          if (TurndownService) {
            const range = sel.getRangeAt(0)
            const div = document.createElement('div')
            div.appendChild(range.cloneContents())
            // Simple approach: copy the full doc markdown for now
          }
        }
        // Fallback: copy the full document markdown
        navigator.clipboard.writeText(doc)
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
  }, [
    toggleSidebar, editorMode, setEditorMode, toggleFocusMode,
    zoomIn, zoomOut, zoomReset, setSettingsOpen,
  ])
}
