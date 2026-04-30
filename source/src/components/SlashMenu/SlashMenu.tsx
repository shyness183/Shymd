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
 * Opens when the user types `/` at line start OR immediately after
 * whitespace (Notion-style relaxed trigger). The palette filters as
 * they keep typing, supports ↑/↓ to navigate, Enter/Tab to confirm,
 * Esc to dismiss.
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
  // Ref mirror of `state` so the event handlers always read the latest
  // value even when the effect hasn't re-run yet (avoiding stale closure).
  const stateRef = useRef<OpenState | null>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const lastSlashPosRef = useRef<number | null>(null)

  const setSlashState = (s: OpenState | null) => {
    stateRef.current = s
    setState(s)
  }

  const filtered = useMemo(() => filterSlashCommands(query), [query])

  const close = () => {
    setSlashState(null)
    setQuery('')
    setIndex(0)
    lastSlashPosRef.current = null
  }

  useEffect(() => {
    if (!state) return
    const el = listRef.current?.children[index] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [index, state, filtered.length])

  useEffect(() => {
    if (index >= filtered.length) setIndex(0)
  }, [filtered.length, index])

  // ── Source-mode (CodeMirror) ──────────────────────────────────────
  useEffect(() => {
    if (editorMode !== 'source') return
    const view = getEditorView()
    if (!view) return

    const onInput = () => {
      const v = getEditorView()
      if (!v) return
      const { from, to } = v.state.selection.main
      if (from !== to) return
      const line = v.state.doc.lineAt(from)
      const textBefore = line.text.slice(0, from - line.from)
      // Bail if we're inside a fenced code block.
      const before = v.state.doc.sliceString(0, line.from)
      const fenceMatches = before.match(/^```/gm)
      if (fenceMatches && fenceMatches.length % 2 === 1) {
        if (stateRef.current?.mode === 'source') close()
        return
      }
      // Fully relaxed trigger: any `/` typed in plain text opens the
      // menu — except when the slash is immediately preceded by another
      // `/` (avoids URL paths like `https://` and `path/to/file`
      // hijacking every keystroke).
      const m = textBefore.match(/(^|\s)\/([^\s/]*)$/)
      if (m) {
        const slashPos = from - (m[2].length + 1)
        const coords = v.coordsAtPos(slashPos)
        if (!coords) { if (stateRef.current) close(); return }
        setQuery(m[2])
        setIndex(0)
        lastSlashPosRef.current = slashPos
        setSlashState({
          mode: 'source',
          x: coords.left,
          y: coords.bottom + 4,
          slashPos,
        })
      } else if (stateRef.current?.mode === 'source' && lastSlashPosRef.current !== null) {
        close()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (!stateRef.current || stateRef.current.mode !== 'source') return
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setIndex((i) => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); e.stopPropagation(); setIndex((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          runCommand(filtered[index])
        }
      }
    }

    const dom = view.contentDOM
    dom.addEventListener('input', onInput)
    document.addEventListener('keydown', onKey, true)
    return () => {
      dom.removeEventListener('input', onInput)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [editorMode, state, filtered, index])

  // ── WYSIWYG-mode (contentEditable) ─────────────────────────────────
  useEffect(() => {
    if (editorMode !== 'wysiwyg') return
    const root = getCERoot()
    if (!root) return

    const scan = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) { if (stateRef.current?.mode === 'wysiwyg') close(); return }
      const anchor = sel.anchorNode
      if (!anchor || anchor.nodeType !== Node.TEXT_NODE || !root.contains(anchor)) {
        if (stateRef.current?.mode === 'wysiwyg') close()
        return
      }
      const textNode = anchor as Text
      // Bail when the caret is inside code/pre.
      const parentEl = textNode.parentElement
      if (parentEl && parentEl.closest('pre, code')) {
        if (stateRef.current?.mode === 'wysiwyg') close()
        return
      }
      const offset = sel.anchorOffset
      const before = textNode.nodeValue?.slice(0, offset) || ''
      // Fully relaxed trigger: any `/` opens the menu unless preceded
      // by another `/` (URL paths).
      const m = before.match(/(^|\s)\/([^\s/]*)$/)
      if (m) {
        const textOffset = offset - (m[2].length + 1)
        const range = document.createRange()
        range.setStart(textNode, textOffset)
        range.setEnd(textNode, offset)
        const rect = range.getBoundingClientRect()
        if (!rect || (rect.width === 0 && rect.height === 0)) return
        setQuery(m[2])
        setIndex(0)
        setSlashState({
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
      if (!stateRef.current || stateRef.current.mode !== 'wysiwyg') return
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setIndex((i) => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); e.stopPropagation(); setIndex((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length > 0) {
          e.preventDefault()
          e.stopPropagation()
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
  }, [editorMode, state, filtered, index])

  useEffect(() => {
    if (!state) return
    const onDown = () => close()
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown, { once: true })
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [state])

  const runCommand = async (cmd: SlashCommand) => {
    const s = state
    close()
    if (!s) return
    if (s.mode === 'source') {
      const view = getEditorView()
      if (!view || s.slashPos === undefined) return
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
      const sel = window.getSelection()
      if (sel) { sel.removeAllRanges(); sel.addRange(range) }
      cmd.execHtml()
    }
  }

  if (!state) return null

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
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
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

export { SLASH_COMMANDS }
