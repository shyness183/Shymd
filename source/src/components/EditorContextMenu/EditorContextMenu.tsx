import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { PopoverMenu, type PopoverMenuItem } from '../PopoverMenu/PopoverMenu'
import {
  cmdBold, cmdItalic, cmdUnderline, cmdStrikethrough, cmdInlineCode,
  cmdInlineMath, cmdHighlight, cmdHeading, cmdParagraph, cmdQuote,
  cmdOrderedList, cmdUnorderedList, cmdTaskList, cmdCodeBlock,
  cmdMathBlock, cmdHorizontalRule, cmdImage,
  getEditorView,
} from '../../lib/editorCommands'
import {
  htmlBold, htmlItalic, htmlUnderline, htmlStrikethrough, htmlInlineCode,
  htmlInlineMath, htmlHighlight, htmlHeading, htmlParagraph, htmlQuote,
  htmlOrderedList, htmlUnorderedList, htmlTaskList, htmlCodeBlock,
  htmlMathBlock, htmlHorizontalRule, htmlImage,
  getCERoot, saveSelection,
} from '../../lib/htmlEditorCommands'

/**
 * Editor right-click context menu (Item 2 — replaces the floating
 * toolbar as the primary formatting path; floating toolbar is now
 * opt-in via settings.floatingToolbarEnabled).
 *
 * Menu structure (per spec):
 *   剪切 / 复制 / 粘贴 / 纯文本粘贴 / 全选
 *   ─────
 *   文本格式 ▸ 加粗 / 斜体 / 删除线 / 高亮(6色) / 行内代码 / 行内数学 / 注释
 *   段落设置 ▸ 无序 / 有序 / 任务 / H1-6 / 正文 / 引用
 *   插入   ▸ 脚注 / 表格 / 图片 / 标注 / 分隔线 / 代码块 / 数学块
 */

const HIGHLIGHT_PRESETS: Array<{ name: string; color: string }> = [
  { name: '黄', color: 'hsl(50,100%,78%)' },
  { name: '绿', color: 'hsl(120,55%,78%)' },
  { name: '蓝', color: 'hsl(210,70%,82%)' },
  { name: '粉', color: 'hsl(340,70%,82%)' },
  { name: '紫', color: 'hsl(280,55%,82%)' },
  { name: '橙', color: 'hsl(28,100%,80%)' },
]

// ── Text-insertion helpers for commands not in the cmd*/html* libs ──

/** Insert text at the source-mode caret (or replace selection). */
function srcInsert(text: string, cursorOffset?: number) {
  const v = getEditorView()
  if (!v) return
  const { from, to } = v.state.selection.main
  v.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + (cursorOffset ?? text.length) },
  })
  v.focus()
}

/** Wrap source-mode selection with `before` and `after`; if collapsed,
 *  insert both with caret in the middle. */
function srcWrap(before: string, after: string) {
  const v = getEditorView()
  if (!v) return
  const { from, to } = v.state.selection.main
  const inner = v.state.doc.sliceString(from, to)
  v.dispatch({
    changes: { from, to, insert: before + inner + after },
    selection: { anchor: from + before.length + inner.length + (inner ? after.length : 0) },
  })
  v.focus()
}

/** Insert text at the wysiwyg caret (replacing selection). */
function htmlInsert(text: string) {
  const root = getCERoot()
  if (!root) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  const r = document.createRange()
  r.setStartAfter(node); r.collapse(true)
  sel.removeAllRanges(); sel.addRange(r)
  root.dispatchEvent(new Event('input', { bubbles: true }))
  root.focus()
}

/** Obsidian-style comment %%text%% — wraps selection or inserts a stub. */
function srcComment() {
  const v = getEditorView()
  if (!v) return
  const { from, to } = v.state.selection.main
  if (from === to) srcInsert('%%注释%%', 2)
  else srcWrap('%%', '%%')
}
function htmlComment() {
  const sel = window.getSelection()
  const text = sel?.isCollapsed ? '%%注释%%' : `%%${sel?.toString() ?? ''}%%`
  htmlInsert(text)
}

/** Footnote: insert ref at caret + append definition placeholder. */
function srcFootnote() {
  const v = getEditorView()
  if (!v) return
  const docText = v.state.doc.toString()
  // Pick a fresh footnote number.
  const used = new Set<number>()
  const re = /\[\^(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(docText))) used.add(parseInt(m[1], 10))
  let n = 1
  while (used.has(n)) n++
  const ref = `[^${n}]`
  const defLine = `\n\n[^${n}]: 脚注内容`
  const { from } = v.state.selection.main
  const end = v.state.doc.length
  v.dispatch({
    changes: [{ from, to: from, insert: ref }, { from: end, to: end, insert: defLine }],
    selection: { anchor: from + ref.length },
  })
  v.focus()
}
function htmlFootnote() {
  // In wysiwyg, just insert the ref inline; defs round-trip via markdown.
  htmlInsert('[^1]')
}

/** Callout block (Obsidian `> [!note]` style). */
function srcCallout() {
  srcInsert('\n> [!note]\n> 内容\n')
}
function htmlCallout() {
  // Wysiwyg representation: a blockquote with a leading `[!note]` text.
  const root = getCERoot()
  if (!root) return
  const bq = document.createElement('blockquote')
  const p1 = document.createElement('p'); p1.textContent = '[!note]'
  const p2 = document.createElement('p'); p2.textContent = '内容'
  bq.appendChild(p1); bq.appendChild(p2)
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    root.appendChild(bq)
  } else {
    sel.getRangeAt(0).insertNode(bq)
  }
  root.dispatchEvent(new Event('input', { bubbles: true }))
}

interface ContextState {
  x: number
  y: number
  mode: 'source' | 'wysiwyg'
}

export function EditorContextMenu() {
  const editorMode = useAppStore((s) => s.editorMode)
  const setTablePickerOpen = useAppStore((s) => s.setTablePickerOpen)
  const [state, setState] = useState<ContextState | null>(null)

  // Listen for contextmenu events on the editor surface.
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      // Only inside our editor surfaces. Don't hijack right-click on the
      // sidebar / dialogs / etc.
      const cm = getEditorView()
      const ce = getCERoot()
      const inSource = !!cm && (cm.dom.contains(e.target as Node) || cm.contentDOM.contains(e.target as Node))
      const inWysiwyg = !!ce && ce.contains(e.target as Node)
      if (!inSource && !inWysiwyg) return
      e.preventDefault()
      const mode: 'source' | 'wysiwyg' = inWysiwyg ? 'wysiwyg' : 'source'
      // Capture the wysiwyg selection BEFORE rendering the menu — clicks
      // inside the menu would otherwise wipe it.
      if (mode === 'wysiwyg') saveSelection()
      setState({ x: e.clientX, y: e.clientY, mode })
    }
    document.addEventListener('contextmenu', onCtx)
    return () => document.removeEventListener('contextmenu', onCtx)
  }, [editorMode])

  if (!state) return null

  const isWysiwyg = state.mode === 'wysiwyg'
  const dispatch = (srcFn: () => void, htmlFn: () => void) => () => {
    if (isWysiwyg) htmlFn()
    else srcFn()
  }
  const dispatchHeading = (lv: number) => () => {
    if (isWysiwyg) htmlHeading(lv)
    else cmdHeading(lv)
  }

  const formatItems: PopoverMenuItem[] = [
    { label: '加粗', shortcut: 'Ctrl+B', onClick: dispatch(cmdBold, htmlBold) },
    { label: '斜体', shortcut: 'Ctrl+I', onClick: dispatch(cmdItalic, htmlItalic) },
    { label: '下划线', shortcut: 'Ctrl+U', onClick: dispatch(cmdUnderline, htmlUnderline) },
    { label: '删除线', onClick: dispatch(cmdStrikethrough, htmlStrikethrough) },
    {
      label: '高亮',
      children: HIGHLIGHT_PRESETS.map((p) => ({
        label: p.name,
        icon: '●',
        onClick: () => {
          if (isWysiwyg) htmlHighlight(p.color)
          else cmdHighlight() // source mode: ==text== (single colour)
        },
      })),
    },
    { label: '行内代码', shortcut: 'Ctrl+`', onClick: dispatch(cmdInlineCode, htmlInlineCode) },
    { label: '行内数学', shortcut: 'Ctrl+Shift+E', onClick: dispatch(cmdInlineMath, htmlInlineMath) },
    { label: '注释 %% %%', onClick: dispatch(srcComment, htmlComment) },
  ]

  const paragraphItems: PopoverMenuItem[] = [
    { label: '正文', shortcut: 'Ctrl+0', onClick: dispatch(cmdParagraph, htmlParagraph) },
    { label: '标题 1', shortcut: 'Ctrl+1', onClick: dispatchHeading(1) },
    { label: '标题 2', shortcut: 'Ctrl+2', onClick: dispatchHeading(2) },
    { label: '标题 3', shortcut: 'Ctrl+3', onClick: dispatchHeading(3) },
    { label: '标题 4', onClick: dispatchHeading(4) },
    { label: '标题 5', onClick: dispatchHeading(5) },
    { label: '标题 6', onClick: dispatchHeading(6) },
    { separator: true },
    { label: '引用', shortcut: 'Ctrl+Shift+Q', onClick: dispatch(cmdQuote, htmlQuote) },
    { label: '无序列表', shortcut: 'Ctrl+Shift+]', onClick: dispatch(cmdUnorderedList, htmlUnorderedList) },
    { label: '有序列表', shortcut: 'Ctrl+Shift+[', onClick: dispatch(cmdOrderedList, htmlOrderedList) },
    { label: '任务列表', onClick: dispatch(cmdTaskList, htmlTaskList) },
  ]

  const insertItems: PopoverMenuItem[] = [
    { label: '脚注', onClick: dispatch(srcFootnote, htmlFootnote) },
    {
      label: '表格',
      shortcut: 'Ctrl+T',
      onClick: () => {
        if (isWysiwyg) saveSelection()
        setTablePickerOpen(true)
      },
    },
    { label: '图片', shortcut: 'Ctrl+Shift+I', onClick: dispatch(cmdImage, htmlImage) },
    { label: '标注 (callout)', onClick: dispatch(srcCallout, htmlCallout) },
    { label: '分隔线', onClick: dispatch(cmdHorizontalRule, htmlHorizontalRule) },
    { label: '代码块', shortcut: 'Ctrl+Shift+K', onClick: dispatch(cmdCodeBlock, htmlCodeBlock) },
    { label: '数学块', shortcut: 'Ctrl+Shift+M', onClick: dispatch(cmdMathBlock, htmlMathBlock) },
  ]

  const items: PopoverMenuItem[] = [
    { label: '剪切', shortcut: 'Ctrl+X', onClick: () => document.execCommand('cut') },
    { label: '复制', shortcut: 'Ctrl+C', onClick: () => document.execCommand('copy') },
    { label: '粘贴', shortcut: 'Ctrl+V', onClick: () => document.execCommand('paste') },
    {
      label: '纯文本粘贴',
      shortcut: 'Ctrl+Shift+V',
      onClick: async () => {
        try {
          const text = await navigator.clipboard.readText()
          if (isWysiwyg) htmlInsert(text)
          else srcInsert(text)
        } catch (e) { console.error(e) }
      },
    },
    { label: '全选', shortcut: 'Ctrl+A', onClick: () => document.execCommand('selectAll') },
    { separator: true },
    { label: '文本格式', children: formatItems },
    { label: '段落设置', children: paragraphItems },
    { label: '插入', children: insertItems },
  ]

  return (
    <PopoverMenu
      items={items}
      x={state.x}
      y={state.y}
      onClose={() => setState(null)}
    />
  )
}
