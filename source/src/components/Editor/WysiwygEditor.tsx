import { useEffect, useRef } from 'react'
import TurndownService from 'turndown'
import { md, renderMermaidBlocks, injectTOC } from '../../lib/markdown'
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

// ─── Main editor ────────────────────────────────────────────────────
export function WysiwygEditor() {
  const doc = useAppStore((s) => s.doc)
  const setDoc = useAppStore((s) => s.setDoc)
  const activeFile = useAppStore((s) => s.activeFile)
  const rootRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  // Initial render & on activeFile change — rebuild HTML from markdown
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.innerHTML = md.render(doc)
    injectTOC(el)
    renderMermaidBlocks(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile])

  // Register root for format commands
  useEffect(() => {
    setCERoot(rootRef.current)
    return () => setCERoot(null)
  }, [])

  // If `doc` changes externally (e.g. programmatic edit, undo), but we
  // are not currently editing this file, sync the DOM. We detect
  // external changes by comparing the current rendered markdown to
  // the incoming doc.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const current = turndown.turndown(el.innerHTML).trim()
    if (current.trim() !== doc.trim() && document.activeElement !== el) {
      el.innerHTML = md.render(doc)
      injectTOC(el)
      renderMermaidBlocks(el)
    }
  }, [doc])

  // Debounced: convert contentEditable HTML back to markdown and save
  const scheduleSave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const el = rootRef.current
      if (!el) return
      const markdown = turndown.turndown(el.innerHTML)
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
    // Normalize non-breaking spaces (\u00A0) to regular spaces for matching
    const text = (block.textContent || '').replace(/\u00A0/g, ' ')

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

  // ─── List continuation on Enter ──────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    // Find closest <li> ancestor
    let node: Node | null = sel.anchorNode
    let li: HTMLLIElement | null = null
    while (node && node !== rootRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
        li = node as HTMLLIElement; break
      }
      node = node.parentNode
    }
    if (!li) return // Not in a list — let browser handle

    const list = li.parentElement
    if (!list || (list.tagName !== 'OL' && list.tagName !== 'UL')) return

    // Check if list item text is empty (ignore checkbox for task lists)
    const textClone = li.cloneNode(true) as HTMLElement
    textClone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove())
    const text = textClone.textContent?.trim() || ''

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

      // Multi-item list, current is empty → exit list (standard behaviour)
      e.preventDefault()
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      list.parentNode?.insertBefore(p, list.nextSibling)
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

    if (afterFrag.textContent?.trim()) {
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
    if (!li.textContent?.trim() && !li.querySelector('input[type="checkbox"]')) {
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
        spellCheck={false}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onClick={onClick}
      />
    </div>
  )
}
