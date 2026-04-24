import { useEffect, useRef, useState, useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { getEditorView } from '../../lib/editorCommands'
import { getCERoot } from '../../lib/htmlEditorCommands'
import { SLASH_COMMANDS, filterSlashCommands, type SlashCommand } from '../../lib/slashCommands'
import styles from './SlashMenu.module.css'

/**
 * Slash-command palette.
 *
 * Opens when the user types `/` at the start of an empty line (or after
 * whitespace — Notion-style). The palette filters as they type, supports
 * ↑ ↓ to navigate, Enter/Tab to confirm, Esc to dismiss.
 *
 * Works across both source mode (CodeMirror) and WYSIWYG mode
 * (contentEditable) — it figures out which editor has focus and routes
 * to the right executor from the shared SLASH_COMMANDS registry.
 */
type Mode = 'source' | 'wysiwyg'

interface OpenState {
  mode: Mode
  x: number
  y: number
  /** Absolute position in the CodeMirror document of the triggering "/". */
  slashPos?: number
  /** In wysiwyg: the Text node where the "/" lives + its offset. */
  textNode?: Text
  textOffset?: number
}

export function SlashMenu() {
  const { locale } = useLocale()
  const editorMode = useAppStore((s) => s.editorMode)
  const [state, setState] = useState<OpenState | null>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => filterSlashCommands(query), [query])

  // ── Close helpers ──────────────────────────────────────────────────
  const close = () => {
    setState(null)
    setQuery('')
    setIndex(0)
  }

  // Keep the highlighted item in view as the list changes.
  useEffect(() => {
    if (!state) return
    const el = listRef.current?.children[index] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [index, state, filtered.length])

  useEffect(() => {
    // When query changes and old index is out of range, reset.
    if (index >= filtered.length) setIndex(0)
  }, [filtered.length, index])

  // ── Source-mode detection (CodeMirror) ────────────────────────────
  useEffect(() => {
    if (editorMode !== 'source') return
    const view = getEditorView()
    if (!view) return

    let lastSlashPos: number | null = null

    const onInput = () => {
      const v = getEditorView()
      if (!v) return
      const { from, to } = v.state.selection.main
      if (from !== to) return
      const line = v.state.doc.lineAt(from)
      const textBefore = line.text.slice(0, from - line.from)
      // Bail if we're inside a fenced code block — count ``` fences
      // from doc start up to the current line.
      const before = v.state.doc.sliceString(0, line.from)
      const fenceMatches = before.match(/^```/gm)
      if (fenceMatches && fenceMatches.length % 2 === 1) {
        if (state?.mode === 'source') close()
        return
      }
      // Only trigger on "/" at the very start or right after whitespace.
      const m = textBefore.match(/(?:^|\s)\/([^\s/]*)$/)
      if (m) {
        const slashPos = from - (m[1].length + 1)
        const coords = v.coordsAtPos(slashPos)
        if (!coords) { if (state) close(); return }
        setQuery(m[1])
        setIndex(0)
        lastSlashPos = slashPos
        setState({
          mode: 'source',
          x: coords.left,
          y: coords.bottom + 4,
          slashPos,
        })
      } else if (state?.mode === 'source' && lastSlashPos !== null) {
        // User navigated away / deleted the slash — close.
        close()
        lastSlashPos = null
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (!state || state.mode !== 'source') return
      if (e.key === 'Escape') { e.preventDefault(); close() }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length > 0) {
          e.preventDefault()
          runCommand(filtered[index])
        }
      }
    }

    // CodeMirror doesn't fire "input" on its contenteditable in a way we
    // can listen to directly; watch the document content via a DOM
    // observer on the scroll DOM. Easier path: listen to `input` on the
    // wrapping container.
    const dom = view.contentDOM
    dom.addEventListener('input', onInput)
    document.addEventListener('keydown', onKey, true)
    return () => {
      dom.removeEventListener('input', onInput)
      document.removeEventListener('keydown', onKey, true)
    }
    // We intentionally exclude `filtered` & `index` from deps — onKey
    // reads them via closure and is refreshed each render because the
    // effect re-runs on mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode, state, filtered, index])

  // ── WYSIWYG-mode detection (contentEditable) ───────────────────────
  useEffect(() => {
    if (editorMode !== 'wysiwyg') return
    const root = getCERoot()
    if (!root) return

    const scan = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) { if (state?.mode === 'wysiwyg') close(); return }
      const anchor = sel.anchorNode
      if (!anchor || anchor.nodeType !== Node.TEXT_NODE || !root.contains(anchor)) {
        if (state?.mode === 'wysiwyg') close()
        return
      }
      const textNode = anchor as Text
      // Bail out when the caret is inside code/pre — users want a literal
      // `/` there, not a command menu.
      const parentEl = textNode.parentElement
      if (parentEl && parentEl.closest('pre, code')) {
        if (state?.mode === 'wysiwyg') close()
        return
      }
      const offset = sel.anchorOffset
      const before = textNode.nodeValue?.slice(0, offset) || ''
      const m = before.match(/(?:^|\s)\/([^\s/]*)$/)
      if (m) {
        const textOffset = offset - (m[1].length + 1)
        const range = document.createRange()
        range.setStart(textNode, textOffset)
        range.setEnd(textNode, offset)
        const rect = range.getBoundingClientRect()
        if (!rect || (rect.width === 0 && rect.height === 0)) return
        setQuery(m[1])
        setIndex(0)
        setState({
          mode: 'wysiwyg',
          x: rect.left,
          y: rect.bottom + 4,
          textNode,
          textOffset,
        })
      } else if (state?.mode === 'wysiwyg') {
        close()
      }
    }

    const onInput = () => scan()
    const onKey = (e: KeyboardEvent) => {
      if (!state || state.mode !== 'wysiwyg') return
      if (e.key === 'Escape') { e.preventDefault(); close() }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length > 0) {
          e.preventDefault()
          runCommand(filtered[index])
        }
      }
    }

    root.addEventListener('input', onInput)
    document.addEventListener('keydown', onKey, true)
    return () => {
      root.removeEventListener('input', onInput)
      document.removeEventListener('keydown', onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode, state, filtered, index])

  // ── Close on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!state) return
    const onDown = () => close()
    // Delay so the current input event finishes.
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown, { once: true })
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [state])

  // ── Run selected command: delete "/query" then execute ────────────
  const runCommand = async (cmd: SlashCommand) => {
    const s = state
    close()
    if (!s) return
    if (s.mode === 'source') {
      const view = getEditorView()
      if (!view || s.slashPos === undefined) return
      // Delete "/query" including the slash and the query text.
      const from = s.slashPos
      const to = from + 1 + query.length
      view.dispatch({
        changes: { from, to, insert: '' },
        selection: { anchor: from },
      })
      view.focus()
      cmd.execSource()
    } else {
      if (!s.textNode) return
      const start = s.textOffset ?? 0
      const end = start + 1 + query.length
      const range = document.createRange()
      range.setStart(s.textNode, start)
      range.setEnd(s.textNode, Math.min(end, s.textNode.nodeValue?.length ?? end))
      range.deleteContents()
      // Move the caret to where the slash was.
      const sel = window.getSelection()
      if (sel) { sel.removeAllRanges(); sel.addRange(range) }
      cmd.execHtml()
    }
  }

  if (!state) return null

  // Clamp to viewport so the menu doesn't spill off the right edge.
  const MENU_W = 280
  const MENU_H = Math.min(320, 44 + filtered.length * 44)
  const left = Math.min(state.x, window.innerWidth - MENU_W - 8)
  const top = state.y + MENU_H > window.innerHeight
    ? Math.max(8, state.y - MENU_H - 28)
    : state.y

  return (
    <div
      className={styles.menu}
      style={{ left, top, width: MENU_W }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className={styles.header}>
        {locale === 'zh-CN' ? '输入 / 插入块' : 'Type / to insert'}
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {locale === 'zh-CN' ? '无匹配' : 'No matches'}
        </div>
      ) : (
        <div className={styles.list} ref={listRef}>
          {filtered.map((c, i) => (
            <button
              type="button"
              key={c.id}
              className={`${styles.item} ${i === index ? styles.itemActive : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => runCommand(c)}
            >
              <span className={styles.icon}>{c.icon}</span>
              <span className={styles.body}>
                <span className={styles.label}>
                  {locale === 'zh-CN' ? c.labelZh : c.labelEn}
                </span>
                <span className={styles.hint}>
                  {locale === 'zh-CN' ? c.hintZh : c.hintEn}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className={styles.footer}>
        ↑↓ {locale === 'zh-CN' ? '选择' : 'Navigate'} · Enter {locale === 'zh-CN' ? '插入' : 'Insert'} · Esc {locale === 'zh-CN' ? '取消' : 'Cancel'}
      </div>
    </div>
  )
}

// Re-export so other files can peek at the registry for testing /
// documentation without re-importing from the library root.
export { SLASH_COMMANDS }
