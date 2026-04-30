import { useEffect, useRef } from 'react'
import { turndown } from '../../lib/turndownService'
import { md, renderMermaidBlocks, injectTOC, resolveRelativeAssets } from '../../lib/markdown'
import { useAppStore } from '../../stores/useAppStore'
import { setCERoot } from '../../lib/htmlEditorCommands'
import { updateContentByPath } from '../../lib/fileTreeUtils'
import styles from './Editor.module.css'

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
const EMPTY_BLOCK_TAGS = new Set(['BLOCKQUOTE', 'PRE'])

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
  const skipDocSyncRef = useRef(false)

  // Initial render & on file change — rebuild HTML from markdown and
  // scroll to the top so the new file starts from its header.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // Safe default: when the doc is empty, markdown-it renders nothing,
    // leaving contentEditable with no block elements — the caret has
    // nowhere to anchor, autoFormat can't find a parent block, and the
    // "Type /" hint has no <p> to attach to.  Seed a minimal paragraph.
    const rendered = md.render(doc) || '<p><br></p>'
    el.innerHTML = rendered
    injectCursorAnchors(el)
    injectTOC(el)
    renderMermaidBlocks(el)
    resolveRelativeAssets(el, activeAbsolutePath)
    if (!doc.trim()) {
      const firstP = el.querySelector('p')
      if (firstP) firstP.setAttribute('data-cursor-hint', 'true')
    }
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

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  // "Type /" hint, now called from onInput instead of selectionchange.
  // DOM attribute writes during selectionchange trigger Chromium style
  // recalc which can corrupt contentEditable input handling.
  const updateHint = () => {
    const root = rootRef.current
    if (!root) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const anchor = sel.anchorNode
    if (!anchor || !root.contains(anchor)) return
    root.querySelectorAll('[data-cursor-hint]').forEach((el) =>
      el.removeAttribute('data-cursor-hint'),
    )
    let node: Node | null = anchor
    while (node && node.parentNode !== root) node = node.parentNode
    if (node && node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (['P', 'DIV'].includes(el.tagName)) {
        const text = el.textContent?.replace(/​/g, '') ?? ''
        const isEmptyBr = el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR'
        if (text === '' || isEmptyBr) el.setAttribute('data-cursor-hint', 'true')
      }
    }
    root.querySelectorAll('span.md-marker').forEach((m) => m.remove())
  }

  // If `doc` changes externally (e.g. programmatic edit, undo), but we
  // are not currently editing this file, sync the DOM. We detect
  // external changes by comparing the current rendered markdown to
  // the incoming doc.  Skip when the change was triggered by our own
  // scheduleSave (common case, every ~400ms) — the DOM clone + turndown
  // comparison is pure waste when content is identical.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (skipDocSyncRef.current) {
      skipDocSyncRef.current = false
      return
    }
    const cleanClone = el.cloneNode(true) as HTMLElement
    cleanClone.querySelectorAll('span.md-marker').forEach((m) => m.remove())
    const current = turndown.turndown(cleanClone.innerHTML.replace(/​/g, '')).trim()
    if (current.trim() !== doc.trim() && document.activeElement !== el) {
      el.innerHTML = md.render(doc) || '<p><br></p>'
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
    // Snapshot the file key AND the DOM NOW, before a file switch can
    // re-render the contentEditable div with the new file's HTML.
    const fileKey = useAppStore.getState().activeFilePath.join('/')
    const el = rootRef.current
    if (!el) return
    const snap = el.cloneNode(true) as HTMLElement
    timerRef.current = window.setTimeout(() => {
      snap.querySelectorAll('span.md-marker').forEach((m) => m.remove())
      const html = snap.innerHTML.replace(/​/g, '')
      const markdown = turndown.turndown(html)
      const state = useAppStore.getState()
      const currentKey = state.activeFilePath.join('/')
      if (currentKey !== fileKey) {
        // The user switched files during the debounce window.  Still
        // persist the old file's content in the in-memory tree so that
        // switching back doesn't lose the unsaved edits.
        const pathArr = fileKey ? fileKey.split('/').filter(Boolean) : []
        if (pathArr.length > 0) {
          useAppStore.setState({
            files: updateContentByPath(state.files, pathArr, markdown),
          })
        }
        return
      }
      skipDocSyncRef.current = true
      setDoc(markdown)
    }, 400)
  }

  // ─── Auto-format: detect markdown syntax and convert to HTML ─────
  const autoFormatRunningRef = useRef(false)
  const autoFormat = () => {
    if (autoFormatRunningRef.current) return
    const el = rootRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return

    autoFormatRunningRef.current = true
    try {
    // Early exit: all auto-format patterns end with a trailing space
    // ("# ", "- ", "> ", "1. ", "- [ ] ", etc.).  If the character right
    // before the caret isn't a space, no pattern can match and we can
    // skip the DOM walk + regex work entirely.
    const anchorNode = sel.anchorNode
    const anchorOffset = sel.anchorOffset
    if (
      anchorNode &&
      anchorNode.nodeType === Node.TEXT_NODE &&
      anchorOffset > 0 &&
      (anchorNode as Text).nodeValue?.charAt(anchorOffset - 1) !== ' '
    ) {
      return
    }
    // Find block-level parent (P or DIV only — skip existing structures)
    let block: HTMLElement | null = null
    let node: Node | null = anchorNode
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
  } finally {
    autoFormatRunningRef.current = false
  }
  }

  // ─── Clean up empty inline formatting wrappers ─────────────────────
  // When the user deletes all text inside a <mark>, <strong>, <em>, etc.,
  // the empty wrapper element lingers in the DOM.  Subsequent typing lands
  // inside it, silently inheriting the formatting.  Remove empty wrappers
  // from the current block on every input event.

  // Clean empty inline wrappers (<strong></strong> etc.) and empty
  // block elements (<blockquote>, <pre>) from the entire editor.
  // Walks the whole root so it catches orphan wrappers regardless
  // of cursor position.
  const cleanupEmptyWrappers = () => {
    const root = rootRef.current
    if (!root) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    const inlineHits: HTMLElement[] = []
    const blockHits: HTMLElement[] = []
    let n: Node | null
    while ((n = walker.nextNode())) {
      const el = n as HTMLElement
      const text = (el.textContent || '').replace(/​/g, '').trim()
      if (INLINE_TAGS.has(el.tagName) && !text) {
        inlineHits.push(el)
      } else if (EMPTY_BLOCK_TAGS.has(el.tagName)) {
        const txt = (el.textContent || '').replace(/​/g, '').trim()
        if (!txt) {
          blockHits.push(el)
        } else if (el.tagName === 'BLOCKQUOTE') {
          const childText = Array.from(el.children).map(c => (c.textContent || '').replace(/​/g, '').trim()).join('')
          if (!childText) blockHits.push(el)
        }
      }
    }
    for (let i = inlineHits.length - 1; i >= 0; i--) {
      const el = inlineHits[i]
      const parent = el.parentNode
      if (!parent) continue
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    }
    for (let i = blockHits.length - 1; i >= 0; i--) {
      const el = blockHits[i]
      const parent = el.parentNode
      if (!parent) continue
      const next = el.nextSibling
      if (!next || (next.nodeType === Node.ELEMENT_NODE && !(next as HTMLElement).textContent?.replace(/​/g, '').trim())) {
        const freshP = document.createElement('p')
        freshP.innerHTML = '<br>'
        el.parentNode?.insertBefore(freshP, el.nextSibling)
      }
      parent.removeChild(el)
    }
  }
  const onInput = () => {
    autoFormat()
    cleanupEmptyWrappers()
    updateHint()
    scheduleSave()
  }

  // ─── List / blockquote / code-block continuation on Enter ───────
  const onKeyDown = (e: React.KeyboardEvent) => {
    // ─── Backspace/Delete: make inline wrappers deletable like chars ──
    // When the cursor sits right outside a <mark>/<strong>/etc. boundary,
    // move it inside so Backspace/Delete can reach the text (and
    // eventually empty the wrapper, triggering cleanupEmptyWrappers).
    // Without this the ZWSP cursor anchor and element boundaries act as
    // invisible "walls" that keystrokes can't cross.
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const s = window.getSelection()
      if (s && s.rangeCount === 1 && s.isCollapsed) {
        const rng = s.getRangeAt(0)
        const node = rng.startContainer
        const offset = rng.startOffset
        const isBackspace = e.key === 'Backspace'

        // Skip ZWSP — it's a transparent cursor anchor, not real text.
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.charAt(isBackspace ? offset - 1 : offset) === '\u200B') {
          // Let browser delete the ZWSP, then clean up on input.
        } else {
          // Cursor right after a wrapper: Backspace → step inside so the
          // browser can reach the text and delete the last character.
          // Don't preventDefault — let the Backspace perform the deletion.
          if (isBackspace && offset === 0 && node.nodeType === Node.TEXT_NODE && node.previousSibling) {
            const prev = node.previousSibling
            if (prev.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has((prev as HTMLElement).tagName)) {
              const last = prev.lastChild
              if (last && last.nodeType === Node.TEXT_NODE) {
                const len = (last.nodeValue || '').replace(/\u200B/g, '').length
                if (len > 0) {
                  const nr = document.createRange()
                  nr.setStart(last, len); nr.collapse(true)
                  s.removeAllRanges(); s.addRange(nr)
                  // No preventDefault — browser deletes last char inside wrapper.
                  return
                }
              }
              // Empty or no text wrapper — remove it.
              e.preventDefault()
              prev.remove()
              scheduleSave()
              return
            }
          }
          // Cursor right before a wrapper: Delete → step inside.
          if (!isBackspace && node.nodeType === Node.TEXT_NODE && node.nextSibling) {
            const next = node.nextSibling
            const textLen = (node.nodeValue || '').replace(/\u200B/g, '').length
            if (offset >= textLen && next.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has((next as HTMLElement).tagName)) {
              const first = next.firstChild
              if (first && first.nodeType === Node.TEXT_NODE) {
                const fLen = (first.nodeValue || '').replace(/\u200B/g, '').length
                if (fLen > 0) {
                  const nr = document.createRange()
                  nr.setStart(first, 0); nr.collapse(true)
                  s.removeAllRanges(); s.addRange(nr)
                  // No preventDefault — browser deletes first char inside wrapper.
                  return
                }
              }
              if (!first) {
                e.preventDefault()
                next.remove()
                scheduleSave()
                return
              }
            }
          }

          // ── Cursor in parent element adjacent to a wrapper ──────────
          // After the ZWSP cursor-anchor is deleted by the first
          // Backspace/Delete, the caret often lands on the parent element
          // (e.g. <p>) at an offset that sits right next to the wrapper.
          // The text-node checks above miss this case — handle it here so
          // inline tags feel as deletable as plain text.
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            if (isBackspace && offset > 0) {
              const child = el.childNodes[offset - 1]
              if (child && child.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has((child as HTMLElement).tagName)) {
                const last = (child as HTMLElement).lastChild
                if (last && last.nodeType === Node.TEXT_NODE) {
                  const len = (last.nodeValue || '').replace(/​/g, '').length
                  if (len > 0) {
                    const nr = document.createRange()
                    nr.setStart(last, len); nr.collapse(true)
                    s.removeAllRanges(); s.addRange(nr)
                    return
                  }
                }
                e.preventDefault(); child.remove(); scheduleSave(); return
              }
            }
            if (!isBackspace && offset < el.childNodes.length) {
              const child = el.childNodes[offset]
              if (child && child.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has((child as HTMLElement).tagName)) {
                const first = (child as HTMLElement).firstChild
                if (first && first.nodeType === Node.TEXT_NODE) {
                  const fLen = (first.nodeValue || '').replace(/​/g, '').length
                  if (fLen > 0) {
                    const nr = document.createRange()
                    nr.setStart(first, 0); nr.collapse(true)
                    s.removeAllRanges(); s.addRange(nr)
                    return
                  }
                }
                if (!first) { e.preventDefault(); child.remove(); scheduleSave(); return }
              }
            }
          }
        }
      }
    }

    // ─── ArrowRight/Left: step out of inline wrappers ────────────────
    // When the caret is at the very end (or start) of an inline-format
    // wrapper like <strong>, <mark>, <code>, etc., the browser keeps it
    // trapped inside — there's no visible text to arrow past.  Manually
    // collapse the selection after (or before) the wrapper so the user
    // can keep navigating with the keyboard.
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.shiftKey) {
      const s = window.getSelection()
      if (s && s.rangeCount === 1 && s.isCollapsed) {
        const rng = s.getRangeAt(0)
        const node = rng.startContainer
        const off = rng.startOffset
        const isRight = e.key === 'ArrowRight'
        if (node.nodeType === Node.TEXT_NODE) {
          const txt = (node.nodeValue || '').replace(/​/g, '')
          const atEnd = isRight && off >= txt.length && !node.nextSibling
          const atStart = !isRight && off === 0 && !node.previousSibling
          if (atEnd || atStart) {
            const parent = node.parentNode
            if (parent && parent.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has((parent as HTMLElement).tagName)) {
              let wrapper: Node = parent
              while (wrapper.parentNode && wrapper.parentNode !== rootRef.current) {
                const gp: Node = wrapper.parentNode
                if (gp.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has((gp as HTMLElement).tagName)) {
                  wrapper = gp
                } else break
              }
              e.preventDefault()
              const nr = document.createRange()
              if (isRight) {
                nr.setStartAfter(wrapper)
              } else {
                nr.setStartBefore(wrapper)
              }
              nr.collapse(true)
              s.removeAllRanges(); s.addRange(nr)
              return
            }
          }
        }
      }
    }

    // ─── ArrowDown: escape from code block ───────────────────────────
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const s = window.getSelection()
      if (s && s.rangeCount === 1 && s.isCollapsed) {
        let n: Node | null = s.anchorNode
        let preEl: HTMLPreElement | null = null
        while (n && n !== rootRef.current) {
          if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'PRE') {
            preEl = n as HTMLPreElement; break
          }
          n = n.parentNode
        }
        if (preEl) {
          // Check if cursor is at or near the end of the code block.
          const code = preEl.querySelector('code')
          const lastLine = code?.lastChild
          const rng = s.getRangeAt(0)
          const endOfBlock = !lastLine ||
            (rng.endContainer === lastLine && rng.endOffset >= (lastLine.textContent?.replace(/\n$/, '').length ?? 0))
          if (endOfBlock) {
            e.preventDefault()
            let nextP = preEl.nextSibling as HTMLElement | null
            if (!nextP || nextP.tagName !== 'P') {
              nextP = document.createElement('p')
              nextP.innerHTML = '<br>'
              preEl.parentNode?.insertBefore(nextP, preEl.nextSibling)
            }
            const r = document.createRange()
            r.setStart(nextP, 0); r.collapse(true)
            s.removeAllRanges(); s.addRange(r)
            scheduleSave()
            return
          }
        }
      }
    }

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
          // No trailing <p> — ArrowDown at end of <pre> (handled below)
          // creates one on demand when the user wants to exit.
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
