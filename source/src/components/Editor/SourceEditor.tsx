import { useEffect, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useAppStore } from '../../stores/useAppStore'
import { setEditorView } from '../../lib/editorCommands'
import { lightTheme, darkTheme } from './cmTheme'
import styles from './Editor.module.css'

// ─── List continuation on Enter ────────────────────────────────────
const listContinuation = keymap.of([{
  key: 'Enter',
  run: (view) => {
    const { from, to } = view.state.selection.main
    if (from !== to) return false // Selection active — let default handle

    const line = view.state.doc.lineAt(from)
    const text = line.text
    const cursorInLine = from - line.from

    // Task list: "  - [ ] content" or "  - [x] content"
    let m = text.match(/^(\s*- \[[ x]\] )(.*)$/)
    if (m) {
      if (!m[2].trim()) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, selection: { anchor: line.from } })
        return true
      }
      const before = text.slice(0, cursorInLine)
      const after = text.slice(cursorInLine)
      const prefix = `${text.match(/^(\s*)/)?.[1] || ''}- [ ] `
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: before + '\n' + prefix + after },
        selection: { anchor: line.from + before.length + 1 + prefix.length },
      })
      return true
    }

    // Ordered list: "  1. content"
    m = text.match(/^(\s*)(\d+)\.\s(.*)$/)
    if (m) {
      if (!m[3].trim()) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, selection: { anchor: line.from } })
        return true
      }
      const before = text.slice(0, cursorInLine)
      const after = text.slice(cursorInLine)
      const prefix = `${m[1]}${parseInt(m[2]) + 1}. `
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: before + '\n' + prefix + after },
        selection: { anchor: line.from + before.length + 1 + prefix.length },
      })
      return true
    }

    // Unordered list: "  - content" / "  * content" / "  + content"
    m = text.match(/^(\s*)([-*+])\s(.*)$/)
    if (m) {
      if (!m[3].trim()) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, selection: { anchor: line.from } })
        return true
      }
      const before = text.slice(0, cursorInLine)
      const after = text.slice(cursorInLine)
      const prefix = `${m[1]}${m[2]} `
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: before + '\n' + prefix + after },
        selection: { anchor: line.from + before.length + 1 + prefix.length },
      })
      return true
    }

    // Blockquote: "> content"
    m = text.match(/^(\s*>+\s?)(.*)$/)
    if (m) {
      if (!m[2].trim()) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, selection: { anchor: line.from } })
        return true
      }
      const before = text.slice(0, cursorInLine)
      const after = text.slice(cursorInLine)
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: before + '\n' + m[1] + after },
        selection: { anchor: line.from + before.length + 1 + m[1].length },
      })
      return true
    }

    return false // Default behavior
  },
}])

const themeCompartment = new Compartment()

export function SourceEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const setDoc = useAppStore((s) => s.setDoc)
  const theme = useAppStore((s) => s.theme)
  const activeFilePath = useAppStore((s) => s.activeFilePath)
  const activeFileKey = activeFilePath.join('/')

  // Centralised extension list so both the initial mount and file-switch
  // rebuilds use the same configuration.
  const buildExtensions = (currentTheme: 'light' | 'dark' | string) => [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    rectangularSelection(),
    indentOnInput(),
    bracketMatching(),
    foldGutter(),
    highlightSelectionMatches(),
    history(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    listContinuation,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    themeCompartment.of(currentTheme === 'dark' ? darkTheme : lightTheme),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setDoc(update.state.doc.toString())
      }
    }),
    EditorView.lineWrapping,
  ]

  useEffect(() => {
    if (!containerRef.current) return

    const currentDoc = useAppStore.getState().doc
    const state = EditorState.create({
      doc: currentDoc,
      extensions: buildExtensions(theme),
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    setEditorView(view)

    return () => {
      view.destroy()
      viewRef.current = null
      setEditorView(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync doc when file switches. Rebuild the entire EditorState so the
  // undo/redo history from the previous file doesn't leak into the new
  // one — otherwise Ctrl+Z could revert the new file into the old file's
  // content. Also resets the scroll position to the top of the new doc.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const newDoc = useAppStore.getState().doc
    const currentDoc = view.state.doc.toString()
    if (currentDoc === newDoc) return
    const fresh = EditorState.create({
      doc: newDoc,
      extensions: buildExtensions(useAppStore.getState().theme),
    })
    view.setState(fresh)
    // Scroll to the top of the new document.
    view.scrollDOM.scrollTop = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileKey])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.reconfigure(
        theme === 'dark' ? darkTheme : lightTheme
      ),
    })
  }, [theme])

  return (
    <div className={styles.editor} style={{ padding: 0 }}>
      <div ref={containerRef} className={styles.sourceContainer} />
    </div>
  )
}
