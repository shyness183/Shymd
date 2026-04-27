import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../../stores/useAppStore'
// Source-mode (CodeMirror) commands
import {
  cmdBold, cmdItalic, cmdStrikethrough, cmdInlineCode,
  cmdHighlight, cmdHyperlink, cmdHeading, cmdParagraph,
  cmdQuote, cmdUnorderedList, cmdOrderedList, cmdTaskList,
  cmdCodeBlock, cmdUnderline, cmdInlineMath, cmdImage, cmdClearFormat,
  getEditorView,
} from '../../lib/editorCommands'
// Edit-mode (contentEditable) commands
import {
  htmlBold, htmlItalic, htmlStrikethrough, htmlInlineCode,
  htmlHighlight, htmlHyperlink, htmlHeading, htmlParagraph,
  htmlQuote, htmlUnorderedList, htmlOrderedList, htmlTaskList,
  htmlCodeBlock, htmlUnderline, htmlInlineMath, htmlImage, htmlClearFormat,
  getCERoot, getActiveMark, getLastHighlightMark,
  saveSelection, restoreSelection,
} from '../../lib/htmlEditorCommands'
import styles from './FloatingToolbar.module.css'

interface ToolbarPos {
  x: number
  y: number
}

type Mode = 'source' | 'wysiwyg'

// ─── Highlight colour palette ──────────────────────────────────────
// Each entry: [label, base hue (HSL), default lightness%]
const HIGHLIGHT_COLORS: { name: string; hue: number; base: string }[] = [
  { name: '黄', hue: 50,  base: 'hsl(50,100%,78%)'  },
  { name: '绿', hue: 120, base: 'hsl(120,55%,78%)'  },
  { name: '蓝', hue: 210, base: 'hsl(210,70%,82%)'  },
  { name: '粉', hue: 340, base: 'hsl(340,70%,82%)'  },
  { name: '紫', hue: 280, base: 'hsl(280,55%,82%)'  },
  { name: '橙', hue: 28,  base: 'hsl(28,100%,80%)'  },
]

/** Given a hue and a shade 0–100 (light to deep), produce an HSL string. */
function hlColor(hue: number, shade: number): string {
  // shade 0 → light (90%), shade 100 → deep (50%)
  const lightness = 90 - (shade / 100) * 40
  const saturation = hue === 50 ? 100 : hue === 120 ? 55 : 70
  return `hsl(${hue},${saturation}%,${lightness}%)`
}

// ─── Button definitions ────────────────────────────────────────────

// "Regular" format buttons — highlight handled separately so it can
// host its own popover.
const makeFormatButtons = (mode: Mode) => [
  { key: 'bold',    label: 'B',   title: '加粗',       action: mode === 'source' ? cmdBold : htmlBold,             style: { fontWeight: 700 } as React.CSSProperties },
  { key: 'italic',  label: 'I',   title: '斜体',       action: mode === 'source' ? cmdItalic : htmlItalic,         style: { fontStyle: 'italic' } as React.CSSProperties },
  { key: 'underline', label: 'U', title: '下划线',     action: mode === 'source' ? cmdUnderline : htmlUnderline,   style: { textDecoration: 'underline' } as React.CSSProperties },
  { key: 'strike',  label: 'S',   title: '删除线',     action: mode === 'source' ? cmdStrikethrough : htmlStrikethrough, style: { textDecoration: 'line-through' } as React.CSSProperties },
  { key: 'code',    label: '</>', title: '行内代码',    action: mode === 'source' ? cmdInlineCode : htmlInlineCode, style: { fontFamily: 'var(--font-code, monospace)', fontSize: '11px', letterSpacing: '-0.5px' } as React.CSSProperties },
  { key: 'math',    label: '∑',   title: '行内数学',    action: mode === 'source' ? cmdInlineMath : htmlInlineMath, style: { fontFamily: 'KaTeX_Math, serif', fontStyle: 'italic' } as React.CSSProperties },
  { key: 'link',    label: '🔗',  title: '超链接',     action: mode === 'source' ? cmdHyperlink : htmlHyperlink,   style: {} as React.CSSProperties },
  { key: 'image',   label: '▦',   title: '插入图片',    action: mode === 'source' ? cmdImage : htmlImage,           style: { fontSize: '14px' } as React.CSSProperties },
  { key: 'clear',   label: '⌫',   title: '清除格式',    action: mode === 'source' ? cmdClearFormat : htmlClearFormat, style: { fontSize: '14px' } as React.CSSProperties },
]

const makeParagraphTypes = (mode: Mode) => {
  const h = mode === 'source' ? cmdHeading : htmlHeading
  const para = mode === 'source' ? cmdParagraph : htmlParagraph
  const quote = mode === 'source' ? cmdQuote : htmlQuote
  const ul = mode === 'source' ? cmdUnorderedList : htmlUnorderedList
  const ol = mode === 'source' ? cmdOrderedList : htmlOrderedList
  const task = mode === 'source' ? cmdTaskList : htmlTaskList
  const code = mode === 'source' ? cmdCodeBlock : htmlCodeBlock
  return [
    { label: '¶ 正文', action: para },
    { label: 'H1 标题 1', action: () => h(1) },
    { label: 'H2 标题 2', action: () => h(2) },
    { label: 'H3 标题 3', action: () => h(3) },
    { label: 'H4 标题 4', action: () => h(4) },
    { label: 'H5 标题 5', action: () => h(5) },
    { label: 'H6 标题 6', action: () => h(6) },
    { label: '> 引用', action: quote },
    { label: '• 无序列表', action: ul },
    { label: '1. 有序列表', action: ol },
    { label: '☑ 任务列表', action: task },
    { label: '{ } 代码块', action: code },
  ]
}

// ─── Component ─────────────────────────────────────────────────────

export function FloatingToolbar() {
  const editorMode = useAppStore((s) => s.editorMode)
  const [pos, setPos] = useState<ToolbarPos | null>(null)
  const [showParagraph, setShowParagraph] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)
  const [hlShade, setHlShade] = useState(30)          // 0-100
  const [hlHue, setHlHue] = useState(50)              // current selected hue
  const toolbarRef = useRef<HTMLDivElement>(null)
  // Tracks the <mark> element being live-edited inside the picker so
  // subsequent slider/swatch changes update its colour in place
  // (htmlHighlight after the first call would no longer find it —
  // the caret has moved to the ZWSP outside the wrapper).
  const activeMarkRef = useRef<HTMLElement | null>(null)

  const closePopovers = () => {
    setShowParagraph(false)
    setShowHighlight(false)
  }

  const handleSelectionChange = useCallback(() => {
    if (editorMode === 'reading') {
      setPos(null)
      return
    }

    if (editorMode === 'source') {
      const view = getEditorView()
      if (!view) { setPos(null); return }
      const { from, to } = view.state.selection.main
      if (from === to) { setPos(null); closePopovers(); return }
      const coords = view.coordsAtPos(to)
      if (!coords) { setPos(null); return }
      const x = Math.max(10, Math.min(coords.left, window.innerWidth - 320))
      const y = Math.max(10, coords.top - 44)
      setPos({ x, y })
      return
    }

    // WYSIWYG mode
    const root = getCERoot()
    const sel = window.getSelection()
    if (!root || !sel || sel.rangeCount === 0) { setPos(null); return }
    if (sel.isCollapsed) { setPos(null); closePopovers(); return }
    const anchor = sel.anchorNode
    if (!anchor || !root.contains(anchor)) { setPos(null); return }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) { setPos(null); return }
    const x = Math.max(10, Math.min(rect.left, window.innerWidth - 320))
    const y = Math.max(10, rect.top - 44)
    setPos({ x, y })
  }, [editorMode])

  useEffect(() => {
    const onMouseUp = () => {
      setTimeout(handleSelectionChange, 10)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key.startsWith('Arrow')) handleSelectionChange()
    }
    const onMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        closePopovers()
      }
    }

    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [handleSelectionChange])

  if (!pos) return null

  const mode: Mode = editorMode === 'source' ? 'source' : 'wysiwyg'
  const formatButtons = makeFormatButtons(mode)
  const paragraphTypes = makeParagraphTypes(mode)
  const isWysiwyg = mode === 'wysiwyg'

  // Detect if selection is already inside a <mark>
  const existingMark = isWysiwyg ? getActiveMark() : null

  const handleHighlightClick = () => {
    if (mode === 'source') {
      // Source: simple toggle with ==...==
      cmdHighlight()
      setPos(null)
      return
    }
    // WYSIWYG: if already highlighted → remove, else open picker
    if (existingMark) {
      htmlHighlight()           // no color → removes the mark
      setShowHighlight(false)
      setPos(null)
    } else {
      // Snapshot the current selection — opening the picker can let
      // the contentEditable lose its selection in some browsers, and
      // we need it intact for the first live-apply call.
      saveSelection()
      activeMarkRef.current = null
      setShowHighlight((v) => !v)
      setShowParagraph(false)
    }
  }

  /**
   * Live-apply highlight at (hue, shade). First call wraps the
   * selection in a fresh <mark> via htmlHighlight; subsequent calls
   * directly mutate the same mark's background so dragging the slider
   * (or clicking another swatch) updates the colour without creating
   * duplicate wrappers or losing the selection.
   */
  const liveApply = (hue: number, shade: number) => {
    const color = hlColor(hue, shade)
    if (activeMarkRef.current && activeMarkRef.current.isConnected) {
      activeMarkRef.current.style.background = color
      return
    }
    // First live-apply this session — re-anchor the snapshotted
    // selection (peek, don't consume — it stays valid as a fallback).
    restoreSelection(false)
    htmlHighlight(color)
    activeMarkRef.current = getLastHighlightMark()
  }

  const applyColor = (hue: number, shade: number) => {
    // Commit + close. Re-apply once in case nothing has been live-applied
    // yet (e.g. user clicked Apply without touching the slider/swatches).
    liveApply(hue, shade)
    setHlHue(hue)
    setHlShade(shade)
    setShowHighlight(false)
    setPos(null)
  }

  return (
    <div
      ref={toolbarRef}
      className={styles.toolbar}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Paragraph selector */}
      <div className={styles.paragraphGroup}>
        <button
          className={`${styles.btn} ${styles.paragraphBtn}`}
          title="段落类型"
          onMouseDown={(e) => {
            e.preventDefault()
            setShowParagraph((v) => !v)
            setShowHighlight(false)
          }}
        >
          ¶ ▾
        </button>
        {showParagraph && (
          <div className={styles.paragraphMenu}>
            {paragraphTypes.map((pt) => (
              <button
                key={pt.label}
                className={styles.paragraphItem}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pt.action()
                  closePopovers()
                  setPos(null)
                }}
              >
                {pt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Regular format buttons */}
      {formatButtons.map((btn) => (
        <button
          key={btn.key}
          className={styles.btn}
          title={btn.title}
          style={btn.style}
          onMouseDown={(e) => {
            e.preventDefault()
            btn.action()
            setPos(null)
          }}
        >
          {btn.label}
        </button>
      ))}

      {/* Highlight button with colour picker */}
      <div className={styles.paragraphGroup}>
        <button
          className={`${styles.btn} ${styles.highlightBtn}${existingMark ? ' ' + styles.highlightActive : ''}`}
          title={existingMark ? '取消高亮' : '高亮'}
          onMouseDown={(e) => {
            e.preventDefault()
            handleHighlightClick()
          }}
        >
          <span className={styles.highlightIcon}>A</span>
          <span className={styles.highlightBar} style={{ background: hlColor(hlHue, hlShade) }} />
        </button>

        {showHighlight && (
          <div className={styles.highlightPicker} onMouseDown={(e) => e.preventDefault()}>
            {/* Colour swatches */}
            <div className={styles.hlSwatches}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  className={`${styles.hlSwatch}${c.hue === hlHue ? ' ' + styles.hlSwatchActive : ''}`}
                  style={{ background: hlColor(c.hue, hlShade) }}
                  title={c.name}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setHlHue(c.hue)
                    // Live-apply: the user sees the colour change on the
                    // selection immediately. They can keep clicking other
                    // swatches or dragging the shade slider to fine-tune.
                    liveApply(c.hue, hlShade)
                  }}
                />
              ))}
            </div>
            {/* Shade slider */}
            <div className={styles.hlSliderRow}>
              <span className={styles.hlSliderLabel}>浅</span>
              <input
                type="range"
                className={styles.hlSlider}
                min={0}
                max={100}
                value={hlShade}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value)
                  setHlShade(v)
                  // Live-apply on every drag tick so the user sees the
                  // depth change in real time on the selected text.
                  liveApply(hlHue, v)
                }}
                onChange={(e) => setHlShade(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, ${hlColor(hlHue, 0)}, ${hlColor(hlHue, 100)})`,
                }}
              />
              <span className={styles.hlSliderLabel}>深</span>
            </div>
            {/* Preview + apply */}
            <button
              className={styles.hlApplyBtn}
              style={{ background: hlColor(hlHue, hlShade) }}
              onMouseDown={(e) => {
                e.preventDefault()
                applyColor(hlHue, hlShade)
              }}
            >
              应用此颜色
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
