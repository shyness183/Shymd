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

const themeCompartment = new Compartment()

export function SourceEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const setDoc = useAppStore((s) => s.setDoc)
  const theme = useAppStore((s) => s.theme)
  const activeFile = useAppStore((s) => s.activeFile)

  useEffect(() => {
    if (!containerRef.current) return

    const currentDoc = useAppStore.getState().doc
    const state = EditorState.create({
      doc: currentDoc,
      extensions: [
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
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        themeCompartment.of(theme === 'dark' ? darkTheme : lightTheme),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDoc(update.state.doc.toString())
          }
        }),
        EditorView.lineWrapping,
      ],
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

  // Sync doc when file switches
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const newDoc = useAppStore.getState().doc
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== newDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: newDoc },
      })
    }
  }, [activeFile])

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
