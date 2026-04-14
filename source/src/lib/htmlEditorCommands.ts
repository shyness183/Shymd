// Commands for the contentEditable WYSIWYG surface.
// These operate on the current document selection using execCommand
// and plain DOM. execCommand is deprecated but remains the pragmatic
// choice for Typora-style editors where we need live formatting.

// Global ref to the active contentEditable container so commands can
// refocus it and so the floating toolbar can check if the selection
// belongs to us.
let _ceRoot: HTMLElement | null = null

export function setCERoot(el: HTMLElement | null) {
  _ceRoot = el
}
export function getCERoot(): HTMLElement | null {
  return _ceRoot
}

function focusRoot() {
  _ceRoot?.focus()
}

function selectionInsideRoot(): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !_ceRoot) return false
  const node = sel.anchorNode
  return !!node && _ceRoot.contains(node)
}

// ─── Inline formatting (execCommand) ────────────────────────────────

export function htmlBold() {
  if (!selectionInsideRoot()) return
  document.execCommand('bold')
  focusRoot()
}
export function htmlItalic() {
  if (!selectionInsideRoot()) return
  document.execCommand('italic')
  focusRoot()
}
export function htmlUnderline() {
  if (!selectionInsideRoot()) return
  document.execCommand('underline')
  focusRoot()
}
export function htmlStrikethrough() {
  if (!selectionInsideRoot()) return
  document.execCommand('strikeThrough')
  focusRoot()
}

// Wrap selection in an inline element with a class.
function wrapSelectionWith(tagName: string, attrs: Record<string, string> = {}) {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const el = document.createElement(tagName)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  try {
    el.appendChild(range.extractContents())
    range.insertNode(el)
    // Re-select the newly inserted content
    sel.removeAllRanges()
    const r = document.createRange()
    r.selectNodeContents(el)
    sel.addRange(r)
  } catch {
    // ignore
  }
  focusRoot()
}

// Walk up from `node` to the first ancestor with the given tagName, stopping
// at `root`. Returns null if not found.
function findAncestorTag(
  node: Node | null,
  tagName: string,
  root: HTMLElement | null,
): HTMLElement | null {
  const upper = tagName.toUpperCase()
  let el: Node | null = node
  while (el && el !== root) {
    if (el.nodeType === Node.ELEMENT_NODE && (el as HTMLElement).tagName === upper) {
      return el as HTMLElement
    }
    el = el.parentNode
  }
  return null
}

/** Unwrap an element: replace it with its children, then select the same range. */
function unwrapElement(el: HTMLElement) {
  const parent = el.parentNode
  if (!parent) return
  const range = document.createRange()
  const frag = document.createDocumentFragment()
  while (el.firstChild) frag.appendChild(el.firstChild)
  // Track the start/end of the unwrapped content so we can re-select it
  const first = frag.firstChild
  const last = frag.lastChild
  parent.replaceChild(frag, el)
  if (first && last) {
    range.setStartBefore(first)
    range.setEndAfter(last)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
}

export function htmlInlineCode() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const existing = findAncestorTag(sel.anchorNode, 'code', _ceRoot)
  if (existing) {
    unwrapElement(existing)
    focusRoot()
    return
  }
  wrapSelectionWith('code')
}

/**
 * Toggle a `<mark>` wrapper on the current selection. If `color` is provided
 * and no mark exists, the new mark is given an inline background style so it
 * can round-trip through raw-HTML markdown. If a mark already exists:
 *   - passing `color` replaces the existing color
 *   - passing no `color` (or `null`) removes the mark entirely.
 */
export function htmlHighlight(color?: string | null) {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const existing = findAncestorTag(sel.anchorNode, 'mark', _ceRoot)

  if (existing) {
    if (color) {
      existing.style.background = color
      focusRoot()
      return
    }
    // No color provided → toggle off
    unwrapElement(existing)
    focusRoot()
    return
  }

  // No existing mark. If the selection is collapsed, nothing to highlight.
  if (sel.isCollapsed) return

  // Create a fresh mark; attach color if provided.
  const range = sel.getRangeAt(0)
  const mark = document.createElement('mark')
  if (color) mark.style.background = color
  try {
    mark.appendChild(range.extractContents())
    range.insertNode(mark)
    sel.removeAllRanges()
    const r = document.createRange()
    r.selectNodeContents(mark)
    sel.addRange(r)
  } catch {
    /* noop */
  }
  focusRoot()
}

/** Returns the currently-active <mark> ancestor of the selection, or null. */
export function getActiveMark(): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return findAncestorTag(sel.anchorNode, 'mark', _ceRoot)
}

export function htmlHyperlink() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  // Save selection — prompt() may collapse it
  const range = sel.getRangeAt(0).cloneRange()
  const hasText = !sel.isCollapsed

  const url = prompt('链接地址', 'https://')
  if (!url) { focusRoot(); return }

  // Restore selection
  sel.removeAllRanges()
  sel.addRange(range)

  if (hasText) {
    document.execCommand('createLink', false, url)
  } else {
    // No text selected — insert a new <a> with the URL as display text
    const a = document.createElement('a')
    a.href = url
    a.textContent = url
    range.insertNode(a)
    sel.removeAllRanges()
    const r = document.createRange()
    r.selectNodeContents(a)
    sel.addRange(r)
  }
  focusRoot()
}

// ─── Block / paragraph formatting ───────────────────────────────────

function setBlockType(tag: string) {
  if (!selectionInsideRoot()) return
  // formatBlock requires an uppercase tag name with angle brackets in
  // some browsers; using the lowercase name with brackets is the safest.
  document.execCommand('formatBlock', false, `<${tag}>`)
  focusRoot()
}

export function htmlParagraph() { setBlockType('p') }
export function htmlHeading(level: number) { setBlockType(`h${level}`) }
export function htmlQuote() { setBlockType('blockquote') }

export function htmlUnorderedList() {
  if (!selectionInsideRoot()) return
  document.execCommand('insertUnorderedList')
  focusRoot()
}

export function htmlOrderedList() {
  if (!selectionInsideRoot()) return
  document.execCommand('insertOrderedList')
  focusRoot()
}

// Task list: insert a <ul class="task-list"><li class="task-list-item">…</li></ul>
export function htmlTaskList() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const text = sel.toString() || '任务'
  const ul = document.createElement('ul')
  ul.className = 'task-list'
  const li = document.createElement('li')
  li.className = 'task-list-item'
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.disabled = false
  li.appendChild(cb)
  li.appendChild(document.createTextNode(' ' + text))
  ul.appendChild(li)
  range.deleteContents()
  range.insertNode(ul)
  focusRoot()
}

// Insert a table with `rows` data rows and `cols` columns.
export function htmlTable(rows: number, cols: number) {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th')
    th.textContent = `列 ${c + 1}`
    headRow.appendChild(th)
  }
  thead.appendChild(headRow)
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr')
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td')
      td.innerHTML = '&nbsp;'
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(table)
  focusRoot()
}

// Code block (<pre><code>…</code></pre>)
export function htmlCodeBlock() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const text = sel.toString() || ''
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.textContent = text || '\n'
  pre.appendChild(code)
  range.deleteContents()
  range.insertNode(pre)
  focusRoot()
}

// Horizontal rule
export function htmlHorizontalRule() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const hr = document.createElement('hr')
  range.collapse(false)
  range.insertNode(hr)
  // Move cursor after the hr
  const r = document.createRange()
  r.setStartAfter(hr)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
  focusRoot()
}

// Image — prompt for URL, insert <img>
export function htmlImage() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0).cloneRange()
  const altText = sel.isCollapsed ? '' : sel.toString()

  const url = prompt('图片地址', 'https://')
  if (!url) { focusRoot(); return }

  sel.removeAllRanges()
  sel.addRange(range)

  const img = document.createElement('img')
  img.src = url
  img.alt = altText || 'image'
  range.deleteContents()
  range.insertNode(img)
  focusRoot()
}

// Inline math — wrap selection in <code class="language-math"> for display,
// and Turndown converts it back to $...$
export function htmlInlineMath() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0).cloneRange()
  const tex = sel.isCollapsed ? '' : sel.toString()

  const formula = prompt('LaTeX 公式', tex || 'E=mc^2')
  if (!formula) { focusRoot(); return }

  sel.removeAllRanges()
  sel.addRange(range)

  // Insert raw $formula$ text — the turndown→markdown→re-render cycle
  // will produce KaTeX rendering on next save
  const span = document.createElement('span')
  span.textContent = `$${formula}$`
  range.deleteContents()
  range.insertNode(span)
  focusRoot()
}

// Math block — insert $$...$$ block
export function htmlMathBlock() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0).cloneRange()

  const formula = prompt('LaTeX 块级公式', '\\int_0^1 x^2 dx')
  if (!formula) { focusRoot(); return }

  sel.removeAllRanges()
  sel.addRange(range)

  const div = document.createElement('div')
  div.textContent = `$$${formula}$$`
  range.collapse(false)
  range.insertNode(div)
  focusRoot()
}
