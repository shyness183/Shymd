import { useEffect, useRef } from 'react'
import TurndownService from 'turndown'
import { md, renderMermaidBlocks, injectTOC, resolveRelativeAssets } from '../../lib/markdown'
import { useAppStore } from '../../stores/useAppStore'
import { setCERoot } from '../../lib/htmlEditorCommands'
import styles from './Editor.module.css'

// ─── Turndown config ────────────────────────────────────────────────
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
})

// GFM strikethrough
turndown.addRule('strikethrough', {
  filter: ['del', 's'] as any,
  replacement: (content) => `~~${content}~~`,
})

// Underline — markdown has no canonical syntax for underline, so we
// preserve <u> as raw HTML. markdown-it has html:true on, so it
// renders back to <u> on the next pass. Without this rule, turndown
// would strip the tag and lose the formatting.
turndown.addRule('underline', {
  filter: ['u'] as any,
  replacement: (content) => `<u>${content}</u>`,
})

// Highlight (mark) — colored marks keep raw HTML so the color round-trips;
// plain marks become `==text==`.
turndown.addRule('highlight', {
  filter: ['mark'] as any,
  replacement: (content, node) => {
    const el = node as HTMLElement
    const bg = el.style?.background || el.style?.backgroundColor
    if (bg) {
      return `<mark style="background:${bg}">${content}</mark>`
    }
    return `==${content}==`
  },
})

// Task list items
turndown.addRule('taskListItem', {
  filter: (node) =>
    node.nodeName === 'LI' &&
    !!node.querySelector('input[type="checkbox"]'),
  replacement: (_content, node) => {
    const el = node as HTMLElement
    const cb = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const checked = cb?.checked ? 'x' : ' '
    // Get text without the checkbox
    const clone = el.cloneNode(true) as HTMLElement
    const cc = clone.querySelector('input[type="checkbox"]')
    if (cc) cc.remove()
    const text = clone.textContent?.trim() || ''
    return `- [${checked}] ${text}\n`
  },
})

// KaTeX: convert rendered math back to $...$ or $$...$$
turndown.addRule('katex', {
  filter: (node) => {
    const el = node as HTMLElement
    return el.classList?.contains('katex') || el.tagName === 'EQ' || el.tagName === 'EQN'
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement
    // Try to find the annotation with TeX source
    const ann = el.querySelector('annotation[encoding="application/x-tex"]')
    const tex = ann?.textContent || el.textContent || ''
    const block = el.tagName === 'EQN' || el.classList?.contains('katex-display')
    return block ? `\n\n$$${tex}$$\n\n` : `$${tex}$`
  },
})

// Preserve <pre><code class="language-xxx"> as fenced code blocks
turndown.addRule('fencedCodeBlock', {
  filter: (node) =>
    node.nodeName === 'PRE' && !!node.firstChild && node.firstChild.nodeName === 'CODE',
  replacement: (_content, node) => {
    const code = (node as HTMLElement).querySelector('code')
    const langClass = code?.className.match(/language-(\w+)/)
    const lang = langClass ? langClass[1] : ''
    const text = code?.textContent || ''
    return '\n\n```' + lang + '\n' + text.replace(/\n$/, '') + '\n```\n\n'
  },
})

// Preserve .mermaid-block as ```mermaid fenced blocks
turndown.addRule('mermaidBlock', {
  filter: (node) => {
    const el = node as HTMLElement
    return el.classList?.contains('mermaid-block') === true
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement
    // If rendered as SVG, we can't get the source back easily;
    // use the original textContent if available
    const svg = el.querySelector('svg')
    const code = svg ? (el.getAttribute('data-source') || '') : (el.textContent || '')
    return '\n\n```mermaid\n' + code.trim() + '\n```\n\n'
  },
})

// Images — turndown's default swallows images whose src contains
// parentheses or encoded characters (e.g. Tauri asset:// URLs with
// %3A). Use an <angle-bracket> URL so the source survives the round
// trip verbatim.
turndown.addRule('image', {
  filter: 'img',
  replacement: (_content, node) => {
    const el = node as HTMLImageElement
    const alt = (el.getAttribute('alt') || '').replace(/[\[\]]/g, '')
    // Prefer the pre-resolution path stashed by resolveRelativeAssets
    // so we don't bake asset:// URLs into the saved markdown.
    const src = el.getAttribute('data-raw-src') || el.getAttribute('src') || ''
    const title = el.getAttribute('title') || ''
    if (!src) return ''
    const needsAngle = /[()\s]/.test(src)
    const srcPart = needsAngle ? `<${src}>` : src
    const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : ''
    return `![${alt}](${srcPart}${titlePart})`
  },
})

// Tables — turndown's default emits plaintext that doesn't round-trip.
// Convert to GFM pipe tables which markdown-it's built-in table rule
// renders back to <table>.
turndown.addRule('gfmTable', {
  filter: 'table',
  replacement: (_content, node) => {
    const table = node as HTMLTableElement
    const rows = Array.from(table.rows)
    if (rows.length === 0) return ''
    const cellText = (c: HTMLTableCellElement) =>
      (c.textContent || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
    const headCells = Array.from(rows[0].cells).map(cellText)
    const cols = headCells.length || 1
    const header = '| ' + headCells.join(' | ') + ' |'
    const sep = '| ' + Array(cols).fill('---').join(' | ') + ' |'
    const body = rows.slice(1).map((r) => {
      const cells = Array.from(r.cells).map(cellText)
      while (cells.length < cols) cells.push('')
      return '| ' + cells.join(' | ') + ' |'
    })
    return '\n\n' + [header, sep, ...body].join('\n') + '\n\n'
  },
})
// Skip nested table children so gfmTable has sole control.
turndown.addRule('tableParts', {
  filter: ['thead', 'tbody', 'tr', 'th', 'td'] as any,
  replacement: (content) => content,
})

// Preserve .front-matter as YAML front matter
turndown.addRule('frontMatter', {
  filter: (node) => {
    const el = node as HTMLElement
    return el.classList?.contains('front-matter') === true
  },
  replacement: (_content, node) => {
    const code = (node as HTMLElement).querySelector('code')
    const text = code?.textContent || ''
    return '---\n' + text.trim() + '\n---\n\n'
  },
})

// ─── Cursor anchor injection ────────────────────────────────────────
// After markdown re-renders into the contentEditable, inline format
// elements (mark, strong, em, code, etc.) that sit at the end of a
// block element have no text node after them.  contentEditable then
// places the caret inside the wrapper when the user clicks past it,
// so typing inherits the format.  Inject a ZWSP text node as a
// clickable cursor anchor so the user can place the caret outside.
// Block-level elements (pre, table, hr, blockquote) that are the last
// child of the editor root also need a trailing paragraph, otherwise
// the user cannot click-click out of them.
const INLINE_TAGS = new Set([
  'MARK', 'STRONG', 'B', 'EM', 'I', 'U', 'DEL', 'S', 'CODE', 'A',
])
const TAIL_BLOCK_TAGS = new Set([
  'PRE', 'TABLE', 'HR', 'BLOCKQUOTE', 'OL', 'UL',
])

function injectCursorAnchors(root: HTMLElement) {
  const blocks = root.querySelectorAll(
    'p, div, li, td, th, h1, h2, h3, h4, h5, h6',
  )
  for (const block of blocks) {
    // Skip blocks that are truly empty (no visible text).
    if (!block.textContent?.replace(/\u200B/g, '').trim()) continue
    let lastEl: HTMLElement | null = null
    // Walk the lastChild chain to find the deepest last element child.
    let node: Node | null = block.lastChild
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        // Text node found — cursor can already anchor here.  Unless this
        // text lives inside an inline-format wrapper (checked below), the
        // block is fine as-is.
        break
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName
        if (INLINE_TAGS.has(tag)) {
          lastEl = node as HTMLElement
          node = node.lastChild // keep walking — may have nested inlines (e.g. <strong><mark>text</mark></strong>)
          continue
        }
        // Non-inline element (e.g. <br>, <input>, <img>) — no anchor needed.
        break
      }
      break
    }
    if (!lastEl) continue
    // The deepest-last element is still inside an inline wrapper that
    // sits at the end of the block.  Add a ZWSP after the outermost
    // inline wrapper so the caret can land outside it.
    let wrapper: Node | null = lastEl
    while (wrapper && wrapper.parentNode !== block) {
      wrapper = wrapper.parentNode
    }
    if (!wrapper) continue
    const next = wrapper.nextSibling
    if (next && next.nodeType === Node.TEXT_NODE && (next as Text).data === '\u200B') continue
    const zwsp = document.createTextNode('\u200B')
    wrapper.parentNode?.insertBefore(zwsp, wrapper.nextSibling)
  }

  // ─── Trailing-paragraph injection for editor-root block elements ──
  // When a <pre>, <table>, <hr>, <blockquote>, <ol> or <ul> is the last
  // child of the contentEditable root, the user has no clickable area
  // after it to continue typing.  Append a minimal paragraph as anchor.
  const lastRootChild = root.lastChild
  if (lastRootChild && lastRootChild.nodeType === Node.ELEMENT_NODE) {
    const tag = (lastRootChild as HTMLElement).tagName
    if (TAIL_BLOCK_TAGS.has(tag)) {
      const next = lastRootChild.nextSibling
      if (!next || next.nodeType !== Node.ELEMENT_NODE || (next as HTMLElement).tagName !== 'P') {
        const trailing = document.createElement('p')
        trailing.innerHTML = '<br>'
        root.appendChild(trailing)
      }
    }
  }
}

// ─── Main editor ────────────────────────────────────────────────────
export function WysiwygEditor() {
  const doc = useAppStore((s) => s.doc)
  const setDoc = useAppStore((s) => s.setDoc)
  const spellcheck = useAppStore((s) => s.settings.spellcheck)
  const activeFilePath = useAppStore((s) => s.activeFilePath)
  const activeAbsolutePath = useAppStore((s) => s.activeAbsolutePath)
  const activeFileKey = activeFilePath.join('/')
  const rootRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  // Initial render & on file change — rebuild HTML from markdown and
  // scroll to the top so the new file starts from its header.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.innerHTML = md.render(doc)
    injectCursorAnchors(el)
    injectTOC(el)
    renderMermaidBlocks(el)
    resolveRelativeAssets(el, activeAbsolutePath)
    // Scroll the editor and its scrolling ancestor back to the top.
    el.scrollTop = 0
    let parent: HTMLElement | null = el.parentElement
    while (parent) {
      parent.scrollTop = 0
      parent = parent.parentElement
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileKey])

  // Register root for format commands
  useEffect(() => {
    setCERoot(rootRef.current)
    return () => setCERoot(null)
  }, [])

  // Track cursor position to show inline "Type /" hint only on the
  // currently focused empty paragraph. Uses rAF so the hint is updated
  // after DOM mutations from Enter/delete have fully settled.
  useEffect(() => {
    let rafId = 0
    const applyHint = () => {
      const root = rootRef.current
      if (!root) return
      root.querySelectorAll('[data-cursor-hint]').forEach((el) =>
        el.removeAttribute('data-cursor-hint'),
      )
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const anchor = sel.anchorNode
      if (!anchor || !root.contains(anchor)) return
      // Empty-paragraph "Type /" hint
      let node: Node | null = anchor
      while (node && node.parentNode !== root) node = node.parentNode
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (['P', 'DIV'].includes(el.tagName)) {
          const text = el.textContent?.replace(/\u200B/g, '') ?? ''
          const isEmptyBr = el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR'
          if (text === '' || isEmptyBr) el.setAttribute('data-cursor-hint', 'true')
        }
      }

      // ── Live Preview marker reveal (Obsidian-style) ──
      // Insert real-DOM <span class="md-marker" contenteditable="false">
      // children at the start and end of every inline format wrapper
      // ancestor of the caret. Real DOM (instead of ::before/::after
      // pseudo content) is required because pseudo elements with
      // pointer-events:none + user-select:none break contentEditable
      // caret rendering — the cursor literally disappears and typing
      // fails.  contenteditable=false makes the markers atomic so the
      // caret skips them.
      // Markers are stripped before markdown serialization (see
      // scheduleSave / external-change comparison below).
      const TAG_MARKERS: Record<string, [string, string]> = {
        STRONG: ['**', '**'], B: ['**', '**'],
        EM: ['*', '*'], I: ['*', '*'],
        U: ['__', '__'],
        S: ['~~', '~~'], DEL: ['~~', '~~'],
        MARK: ['==', '=='],
        CODE: ['`', '`'],
        // Anchor handled specially — closing form needs the href.
        A: ['[', ']'],
      }
      // Strip every existing marker first (cheap — usually 0–4 spans).
      root.querySelectorAll('span.md-marker').forEach((m) => m.remove())
      // Walk ancestors and inject markers.
      let cur: Node | null = anchor
      while (cur && cur !== root) {
        if (cur.nodeType === Node.ELEMENT_NODE) {
          const el = cur as HTMLElement
          const tag = el.tagName
          const tpl = TAG_MARKERS[tag]
          if (tpl) {
            const [open, close] = tpl
            const openSpan = document.createElement('span')
            openSpan.className = 'md-marker'
            openSpan.setAttribute('contenteditable', 'false')
            openSpan.textContent = open
            const closeSpan = document.createElement('span')
            closeSpan.className = 'md-marker'
            closeSpan.setAttribute('contenteditable', 'false')
            // For <a>, append `(href)` to the closing marker.
            if (tag === 'A') {
              closeSpan.textContent = close + '(' + (el.getAttribute('href') ?? '') + ')'
            } else {
              closeSpan.textContent = close
            }
            el.insertBefore(openSpan, el.firstChild)
            el.appendChild(closeSpan)
          }
        }
        cur = cur.parentNode
      }
    }
    const scheduleHint = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(applyHint)
    }
    document.addEventListener('selectionchange', scheduleHint)
    return () => {
      document.removeEventListener('selectionchange', scheduleHint)
      cancelAnimationFrame(rafId)
    }
  }, [])

  // If `doc` changes externally (e.g. programmatic edit, undo), but we
  // are not currently editing this file, sync the DOM. We detect
  // external changes by comparing the current rendered markdown to
  // the incoming doc.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const cleanClone = el.cloneNode(true) as HTMLElement
    cleanClone.querySelectorAll('span.md-marker').forEach((m) => m.remove())
    const current = turndown.turndown(cleanClone.innerHTML.replace(/​/g, '')).trim()
    if (current.trim() !== doc.trim() && document.activeElement !== el) {
      el.innerHTML = md.render(doc)
      injectCursorAnchors(el)
      injectTOC(el)
      renderMermaidBlocks(el)
      resolveRelativeAssets(el, activeAbsolutePath)
    }
  }, [doc, activeAbsolutePath])

  // Debounced: convert contentEditable HTML back to markdown and save.
  // Two pre-serialization rewrites:
  //   - strip ZWSP caret-escape boundaries inserted by inline-format
  //     commands (anti-inheritance, see placeCaretOutsideAfter)
  //   - strip Live Preview marker spans (see selectionchange handler) —
  //     they're transient UI hints, not real content.
  const scheduleSave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    // Snapshot the file key at scheduling time so the callback discards
    // the save if the user switched files before the 400ms debounce fires.
    const fileKey = useAppStore.getState().activeFilePath.join('/')
    timerRef.current = window.setTimeout(() => {
      const currentKey = useAppStore.getState().activeFilePath.join('/')
      if (currentKey !== fileKey) return
      const el = rootRef.current
      if (!el) return
      // Clone so we can mutate without affecting the live editor DOM.
      const clone = el.cloneNode(true) as HTMLElement
      clone.querySelectorAll('span.md-marker').forEach((m) => m.remove())
      const html = clone.innerHTML.replace(/​/g, '')
      const markdown = turndown.turndown(html)
      setDoc(markdown)
    }, 400)
  }

  // ─── Auto-format: detect markdown syntax and convert to HTML ─────
  const autoFormat = () => {
    const el = rootRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return

    // Find block-level parent (P or DIV only — skip existing structures)
    let block: HTMLElement | null = null
    let node: Node | null = sel.anchorNode
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName
        if (tag === 'P' || tag === 'DIV') { block = node as HTMLElement; break }
        if (['LI', 'PRE', 'CODE', 'BLOCKQUOTE', 'TABLE', 'TH', 'TD',
             'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) return
      }
      node = node.parentNode
    }
    if (!block) return
    // Normalize non-breaking spaces (\u00A0) and ZWSP cursor anchors to regular spaces for matching
    const text = (block.textContent || '').replace(/\u200B/g, '').replace(/\u00A0/g, ' ')

    const place = (n: Node, off = 0) => {
      const r = document.createRange(); r.setStart(n, off); r.collapse(true)
      sel.removeAllRanges(); sel.addRange(r)
    }

    // Ordered list: "1. "
    let m = text.match(/^(\d+)\. $/)
    if (m) {
      const ol = document.createElement('ol')
      const start = parseInt(m[1])
      if (start > 1) ol.start = start
      const li = document.createElement('li')
      li.innerHTML = '<br>'
      ol.appendChild(li)
      block.replaceWith(ol)
      place(li, 0)
      return
    }

    // Task list: "- [ ] " or "- [x] "
    m = text.match(/^- \[[ x]?\] $/)
    if (m) {
      const ul = document.createElement('ul')
      ul.className = 'task-list'
      const li = document.createElement('li')
      li.className = 'task-list-item'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = text.includes('[x]')
      li.appendChild(cb)
      li.appendChild(document.createTextNode(' '))
      ul.appendChild(li)
      block.replaceWith(ul)
      const r = document.createRange()
      r.setStartAfter(li.lastChild!)
      r.collapse(true)
      sel.removeAllRanges(); sel.addRange(r)
      return
    }

    // Unordered list: "- " / "* " / "+ "
    if (/^[-*+] $/.test(text)) {
      const ul = document.createElement('ul')
      const li = document.createElement('li')
      li.innerHTML = '<br>'
      ul.appendChild(li)
      block.replaceWith(ul)
      place(li, 0)
      return
    }

    // Blockquote: "> "
    if (text === '> ') {
      const bq = document.createElement('blockquote')
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      bq.appendChild(p)
      block.replaceWith(bq)
      place(p, 0)
      return
    }

    // Headings: "# " ~ "###### "
    m = text.match(/^(#{1,6}) $/)
    if (m) {
      const h = document.createElement(`h${m[1].length}`)
      h.innerHTML = '<br>'
      block.replaceWith(h)
      place(h, 0)
      return
    }

    // Horizontal rule: "---" or "***" or "___"
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(text.trim())) {
      const hr = document.createElement('hr')
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      block.replaceWith(hr)
      hr.after(p)
      place(p, 0)
      return
    }
  }

  const onInput = () => {
    autoFormat()
    scheduleSave()
  }

  // ─── List / blockquote / code-block continuation on Enter ───────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    // ─── Fenced code-block trigger on Enter ──────────────────────────
    // When the user types ```js (or ``` for plain) and presses Enter on
    // a paragraph whose entire text is the fence-marker, swap that
    // paragraph for a real <pre><code class="language-js"> block. This
    // is what users mean by "the code-block button" — the markdown
    // shorthand. We check this BEFORE walking for bq/li/pre because the
    // current node is a normal <p>, not yet a <pre>.
    {
      let n: Node | null = sel.anchorNode
      let block: HTMLElement | null = null
      while (n && n !== rootRef.current) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const tag = (n as HTMLElement).tagName
          if (tag === 'P' || tag === 'DIV') { block = n as HTMLElement; break }
          // Stop walking if we hit a structural ancestor — those have
          // their own Enter behaviour below.
          if (['LI', 'PRE', 'BLOCKQUOTE', 'TABLE', 'TH', 'TD',
               'H1','H2','H3','H4','H5','H6'].includes(tag)) { block = null; break }
        }
        n = n.parentNode
      }
      if (block) {
        const txt = (block.textContent || '').replace(/\u200B/g, '').replace(/\u00A0/g, ' ').trim()
        const m = txt.match(/^```([\w-]*)$/)
        if (m) {
          e.preventDefault()
          const lang = m[1]
          const pre = document.createElement('pre')
          const code = document.createElement('code')
          if (lang) code.className = `language-${lang}`
          // Seed with one zero-width space so contentEditable keeps a
          // visible caret position inside the empty <code>.
          code.textContent = '\u200B'
          pre.appendChild(code)
          block.replaceWith(pre)
          // Ensure a paragraph exists after the <pre> so the user can
          // click outside the code block to place the cursor.
          if (!pre.nextSibling) {
            const trailing = document.createElement('p')
            trailing.innerHTML = '<br>'
            pre.parentNode?.appendChild(trailing)
          }
          // Place caret at the start of <code> (before the ZWSP).
          const r = document.createRange()
          r.setStart(code.firstChild!, 0); r.collapse(true)
          sel.removeAllRanges(); sel.addRange(r)
          scheduleSave()
          return
        }
      }
    }

    // Find closest relevant ancestor: <li>, <blockquote>, or <pre>.
    // First ancestor we hit wins, so nested list-in-blockquote still
    // prefers list behaviour (correct).
    let node: Node | null = sel.anchorNode
    let li: HTMLLIElement | null = null
    let pre: HTMLPreElement | null = null
    let bq: HTMLQuoteElement | null = null
    while (node && node !== rootRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName
        if (tag === 'LI' && !li && !pre && !bq) { li = node as HTMLLIElement; break }
        if (tag === 'PRE' && !pre) { pre = node as HTMLPreElement; break }
        if (tag === 'BLOCKQUOTE' && !bq) { bq = node as HTMLQuoteElement; break }
      }
      node = node.parentNode
    }

    // ─── Inside <pre><code>: insert a literal newline, never exit ──
    // contentEditable default drops the user out of the <code>; we
    // override to keep them inside so multiline code keeps working.
    if (pre) {
      e.preventDefault()
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const nl = document.createTextNode('\n')
      range.insertNode(nl)
      // If this was the last character of the <code>, Chrome collapses
      // the final \n — append a zero-width space sentinel to keep the
      // cursor visible.
      if (!nl.nextSibling) {
        const zw = document.createTextNode('\u200B')
        nl.parentNode?.appendChild(zw)
        range.setStartAfter(nl)
      } else {
        range.setStartAfter(nl)
      }
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      scheduleSave()
      return
    }

    // ─── Inside <blockquote>: continue with a new <p>, or exit on
    // empty-line Enter (matching standard rich-text editor UX) ─────
    if (bq) {
      // Find the direct-child <p> we're in
      let pNode: HTMLElement | null = null
      let n: Node | null = sel.anchorNode
      while (n && n !== bq) {
        if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'P') {
          pNode = n as HTMLElement; break
        }
        n = n.parentNode
      }
      const currentText = (pNode?.textContent || '').replace(/\u200B/g, '').trim()
      // Empty paragraph + Enter → split the blockquote at this point.
      // The empty <p> becomes a regular paragraph between two halves.
      // Children before pNode stay in the original bq; children AFTER
      // pNode move into a new bq below the escape paragraph. This
      // preserves all surrounding content — the previous implementation
      // dropped subsequent siblings on the floor when the user hit
      // Enter on an empty quote line that wasn't the last one.
      if (pNode && !currentText) {
        e.preventDefault()
        const escape = document.createElement('p')
        escape.innerHTML = '<br>'

        // Collect siblings strictly after pNode (snapshot first; we are
        // about to move them, which mutates the live list).
        const after: ChildNode[] = []
        for (let s = pNode.nextSibling; s; s = s.nextSibling) after.push(s)

        // Insert escape immediately after the original bq.
        bq.parentNode?.insertBefore(escape, bq.nextSibling)

        if (after.length > 0) {
          const bq2 = document.createElement('blockquote')
          for (const s of after) bq2.appendChild(s)
          escape.parentNode?.insertBefore(bq2, escape.nextSibling)
        }

        pNode.remove()
        // If the original bq is now empty (no element children AND no bare
        // text content), remove the husk.  We check both children (elements)
        // and textContent (bare text nodes) because execCommand('formatBlock',
        // '<blockquote>') can produce <blockquote>text</blockquote> without
        // a wrapping <p> — checking only children.length would lose content.
        if (!bq.children.length && !bq.textContent?.trim()) bq.remove()

        const r = document.createRange()
        r.setStart(escape, 0); r.collapse(true)
        sel.removeAllRanges(); sel.addRange(r)
        scheduleSave()
        return
      }
      // Non-empty: split at cursor, new <p> inside the blockquote
      e.preventDefault()
      const range = sel.getRangeAt(0)
      const newP = document.createElement('p')
      if (pNode) {
        const tail = document.createRange()
        tail.setStart(range.endContainer, range.endOffset)
        tail.setEndAfter(pNode.lastChild || pNode)
        const frag = tail.extractContents()
        if (frag.textContent?.replace(/\u200B/g, '').trim() || frag.childNodes.length > 0) {
          newP.appendChild(frag)
        } else {
          newP.appendChild(document.createElement('br'))
        }
        if (pNode.nextSibling) {
          bq.insertBefore(newP, pNode.nextSibling)
        } else {
          bq.appendChild(newP)
        }
      } else {
        newP.appendChild(document.createElement('br'))
        bq.appendChild(newP)
      }
      const nr = document.createRange()
      nr.setStart(newP, 0); nr.collapse(true)
      sel.removeAllRanges(); sel.addRange(nr)
      scheduleSave()
      return
    }

    if (!li) return // Not in a list — let browser handle

    const list = li.parentElement
    if (!list || (list.tagName !== 'OL' && list.tagName !== 'UL')) return

    // Check if list item text is empty (ignore checkbox for task lists)
    const textClone = li.cloneNode(true) as HTMLElement
    textClone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove())
    const text = (textClone.textContent || '').replace(/\u200B/g, '').trim()

    if (!text) {
      // Empty list item. If this is the ONLY item in the list (i.e., the
      // list was just created by autoFormat from typing "1. ") — create
      // item 2 so the user can actually start a list. Only exit the list
      // when the user presses Enter on an empty continuation item.
      if (list.children.length === 1) {
        e.preventDefault()
        const newLi = document.createElement('li')
        const isTask = !!li.querySelector('input[type="checkbox"]')
        if (isTask) {
          newLi.className = 'task-list-item'
          const cb = document.createElement('input')
          cb.type = 'checkbox'
          cb.disabled = false
          newLi.appendChild(cb)
          newLi.appendChild(document.createTextNode(' '))
        } else {
          newLi.appendChild(document.createElement('br'))
        }
        list.appendChild(newLi)
        const r = document.createRange()
        if (isTask && newLi.childNodes.length > 1) {
          r.setStartAfter(newLi.childNodes[1])
        } else {
          r.setStart(newLi, 0)
        }
        r.collapse(true)
        sel.removeAllRanges()
        sel.addRange(r)
        scheduleSave()
        return
      }

      // Multi-item list, current is empty → exit at this position. Same
      // shape as the blockquote split: items before stay in the
      // original list; items after move into a new sibling list, with
      // an empty <p> between for the cursor. Without the split we'd
      // silently warp the user past every remaining item below.
      e.preventDefault()
      const p = document.createElement('p')
      p.innerHTML = '<br>'

      const after: ChildNode[] = []
      for (let s = li.nextSibling; s; s = s.nextSibling) after.push(s)

      list.parentNode?.insertBefore(p, list.nextSibling)

      if (after.length > 0) {
        const list2 = document.createElement(list.tagName.toLowerCase()) as HTMLOListElement | HTMLUListElement
        // Preserve OL start counting where possible
        if (list.tagName === 'OL') {
          const items = list.children
          // The new list should continue numbering after the items left
          // behind in the original list (excluding the removed `li`).
          const remainingBefore = Array.from(items).indexOf(li)
          const baseStart = (list as HTMLOListElement).start || 1
          ;(list2 as HTMLOListElement).start = baseStart + remainingBefore
        }
        // Preserve task-list class if present
        if (list.classList.contains('task-list')) list2.classList.add('task-list')
        for (const s of after) list2.appendChild(s)
        p.parentNode?.insertBefore(list2, p.nextSibling)
      }

      li.remove()
      if (!list.children.length) list.remove()
      const r = document.createRange()
      r.setStart(p, 0)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
      scheduleSave()
      return
    }

    // Non-empty → split at cursor and create new <li>
    e.preventDefault()
    const range = sel.getRangeAt(0)
    const afterRange = document.createRange()
    afterRange.setStart(range.endContainer, range.endOffset)
    afterRange.setEndAfter(li.lastChild || li)
    const afterFrag = afterRange.extractContents()

    const newLi = document.createElement('li')
    const isTask = !!li.querySelector('input[type="checkbox"]')
    if (isTask) {
      newLi.className = 'task-list-item'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.disabled = false
      newLi.appendChild(cb)
      newLi.appendChild(document.createTextNode(' '))
    }

    if (afterFrag.textContent?.replace(/\u200B/g, '').trim()) {
      newLi.appendChild(afterFrag)
    } else {
      newLi.appendChild(document.createElement('br'))
    }

    if (li.nextSibling) {
      list.insertBefore(newLi, li.nextSibling)
    } else {
      list.appendChild(newLi)
    }

    // If current li is now visually empty, add <br>
    if (!li.textContent?.replace(/\u200B/g, '').trim() && !li.querySelector('input[type="checkbox"]')) {
      li.appendChild(document.createElement('br'))
    }

    // Cursor at start of new item
    const nr = document.createRange()
    if (isTask && newLi.childNodes.length > 1) {
      nr.setStartAfter(newLi.childNodes[1]) // after checkbox + space
    } else {
      nr.setStart(newLi, isTask ? 2 : 0)
    }
    nr.collapse(true)
    sel.removeAllRanges()
    sel.addRange(nr)
    scheduleSave()
  }

  // ─── Ctrl+Click to open links ────────────────────────────────────
  const openExternal = async (url: string) => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(url)
        return
      } catch (err) {
        console.error('Failed to open URL via Tauri opener:', err)
      }
    }
    window.open(url, '_blank')
  }

  const onClick = (e: React.MouseEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    let node: Node | null = e.target as Node
    while (node && node !== rootRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'A') {
        const href = (node as HTMLAnchorElement).href
        if (href) {
          e.preventDefault()
          openExternal(href)
        }
        return
      }
      node = node.parentNode
    }
  }

  return (
    <div className={styles.editor}>
      <div
        ref={rootRef}
        className={`${styles.content} ${styles.wysiwyg}`}
        data-find-root="true"
        contentEditable
        suppressContentEditableWarning
        spellCheck={spellcheck}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onClick={onClick}
      />
    </div>
  )
}
