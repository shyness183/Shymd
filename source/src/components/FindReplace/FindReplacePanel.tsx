import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import {
  getFindRoot,
  collectMatches,
  applyHighlights,
  clearHighlights,
  scrollMatchIntoView,
  replaceMatch,
  type FindMatch,
} from '../../lib/findReplace'
import { md, resolveRelativeAssets } from '../../lib/markdown'
import TurndownService from 'turndown'
import styles from './FindReplacePanel.module.css'

// Lightweight turndown for sync-back — reuses WysiwygEditor-style rules
// at a minimum. Only used when the WYSIWYG surface is active.
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
})

export function FindReplacePanel() {
  const open = useAppStore((s) => s.findOpen)
  const mode = useAppStore((s) => s.findMode)
  const setFindOpen = useAppStore((s) => s.setFindOpen)
  const editorMode = useAppStore((s) => s.editorMode)
  const setDoc = useAppStore((s) => s.setDoc)

  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matches, setMatches] = useState<FindMatch[]>([])
  const [current, setCurrent] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus + select on open
  useEffect(() => {
    if (open) {
      // Defer so the input exists
      setTimeout(() => findInputRef.current?.focus(), 20)
      setTimeout(() => findInputRef.current?.select(), 30)
    } else {
      clearHighlights()
      setMatches([])
      setCurrent(0)
    }
  }, [open])

  // Recompute matches when query / mode / caseSensitive changes
  const recompute = useCallback(
    (preserveIndex = false) => {
      const root = getFindRoot()
      if (!root || !query) {
        setMatches([])
        setCurrent(0)
        clearHighlights()
        return
      }
      const next = collectMatches(root, query, { caseSensitive })
      setMatches(next)
      const nextIdx = preserveIndex && next.length ? Math.min(current, next.length - 1) : 0
      setCurrent(nextIdx)
      applyHighlights(next, nextIdx)
      if (next[nextIdx]) scrollMatchIntoView(next[nextIdx])
    },
    [query, caseSensitive, current],
  )

  useEffect(() => {
    if (!open) return
    recompute(false)
    // Only re-run when the query or options change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive, open])

  const goTo = (idx: number) => {
    if (matches.length === 0) return
    const n = (idx + matches.length) % matches.length
    setCurrent(n)
    applyHighlights(matches, n)
    scrollMatchIntoView(matches[n])
  }

  const next = () => goTo(current + 1)
  const prev = () => goTo(current - 1)

  // Sync DOM changes back to the doc store for the WYSIWYG surface.
  // For reading mode, replacements don't persist.
  const syncDocFromDOM = () => {
    if (editorMode !== 'wysiwyg') return
    const root = getFindRoot()
    if (!root) return
    const markdown = turndown.turndown(root.innerHTML)
    setDoc(markdown)
  }

  const doReplace = () => {
    if (matches.length === 0 || editorMode === 'reading') return
    const m = matches[current]
    if (!m) return
    replaceMatch(m, replace)
    syncDocFromDOM()
    // Recompute — DOM has shifted
    setTimeout(() => recompute(true), 0)
  }

  const doReplaceAll = () => {
    if (editorMode === 'reading') return
    // We must mutate from the store side, not via a second search in the
    // DOM — because markdown→HTML re-render would wipe our edits. Instead
    // mutate the markdown doc directly, which is simpler and correct.
    const root = getFindRoot()
    if (!root) return
    const currentDoc = useAppStore.getState().doc
    let count = 0
    let nextDoc: string
    if (caseSensitive) {
      const parts = currentDoc.split(query)
      count = parts.length - 1
      nextDoc = parts.join(replace)
    } else {
      const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      nextDoc = currentDoc.replace(re, () => {
        count++
        return replace
      })
    }
    setDoc(nextDoc)
    // Re-render DOM for WYSIWYG to reflect new content, then recompute.
    if (editorMode === 'wysiwyg') {
      root.innerHTML = md.render(nextDoc)
      // Re-resolve relative image paths against the open file's
      // directory; otherwise inline `<img>` references go blank after a
      // find/replace round.
      const abs = useAppStore.getState().activeAbsolutePath
      resolveRelativeAssets(root, abs)
    }
    setTimeout(() => recompute(false), 50)
    if (count > 0) {
      // Brief status nudge via the query placeholder — keep it simple.
      console.debug(`[Shymd] Replaced ${count} occurrence(s)`)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setFindOpen(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) prev()
      else next()
    }
  }

  if (!open) return null

  return (
    <div className={styles.panel} role="dialog" aria-label="Find and Replace">
      <div className={styles.row}>
        <input
          ref={findInputRef}
          className={styles.input}
          placeholder="查找..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <span className={styles.count}>
          {matches.length === 0 ? '0/0' : `${current + 1}/${matches.length}`}
        </span>
        <button className={styles.iconBtn} onClick={prev} title="上一个 (Shift+Enter)">
          ↑
        </button>
        <button className={styles.iconBtn} onClick={next} title="下一个 (Enter)">
          ↓
        </button>
        <button
          className={`${styles.iconBtn} ${caseSensitive ? styles.active : ''}`}
          onClick={() => setCaseSensitive((v) => !v)}
          title="区分大小写"
        >
          Aa
        </button>
        <button className={styles.iconBtn} onClick={() => setFindOpen(false)} title="关闭 (Esc)">
          ×
        </button>
      </div>
      {mode === 'replace' && (
        <div className={styles.row}>
          <input
            className={styles.input}
            placeholder="替换为..."
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={onKey}
          />
          <button className={styles.textBtn} onClick={doReplace} disabled={editorMode === 'reading'}>
            替换
          </button>
          <button className={styles.textBtn} onClick={doReplaceAll} disabled={editorMode === 'reading'}>
            全部替换
          </button>
        </div>
      )}
    </div>
  )
}
