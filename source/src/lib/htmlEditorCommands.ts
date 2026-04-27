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

// ─── Saved selection (for table picker, etc.) ─────────────────────
let _savedRange: Range | null = null

export function saveSelection() {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && _ceRoot && _ceRoot.contains(sel.anchorNode)) {
    _savedRange = sel.getRangeAt(0).cloneRange()
  }
}

/**
 * Restore the previously-saved selection. Exported because the
 * floating toolbar needs to re-anchor the original selection before
 * each live-preview tick of the highlight picker — clicking swatches /
 * dragging the slider can briefly steal the selection in some browsers.
 *
 * `consume` defaults to true (single-shot, matches the original
 * behaviour for table-picker etc.). Pass `false` to peek-and-restore
 * without clearing the saved range.
 */
export function restoreSelection(consume = true): boolean {
  if (!_savedRange || !_ceRoot) return false
  _ceRoot.focus()
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(_savedRange.cloneRange())
  }
  if (consume) _savedRange = null
  return true
}

function focusRoot() {
  _ceRoot?.focus()
  // Notify the editor's `onInput` handler so it schedules a save. DOM
  // mutations via `range.insertNode()` / `appendChild()` / etc. do NOT
  // fire native `input` events on contentEditable — only user-typed
  // edits and `execCommand` do. Without this synthetic dispatch,
  // commands that insert images, tables, code blocks, math blocks,
  // rules, etc. never reach setDoc, so the change is lost when the
  // user switches files. (The built-in `input` event bubbles and is
  // picked up by React's synthetic handler on the contentEditable.)
  _ceRoot?.dispatchEvent(new Event('input', { bubbles: true }))
}

function selectionInsideRoot(): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !_ceRoot) return false
  const node = sel.anchorNode
  return !!node && _ceRoot.contains(node)
}

// ─── Inline formatting (wrap-based, no execCommand) ─────────────────
// We deliberately avoid `document.execCommand('bold' | 'italic' | …)`.
// execCommand sets a "next-typing" formatting flag on a collapsed
// selection, which is what causes formatting to "inherit" into text the
// user types AFTER the originally-formatted run. The wrap approach
// gives us full control over cursor placement, and we put the caret
// AFTER the wrapper so subsequent typing is plain.

// Walk up from `node` to the first ancestor whose tagName is in `tags`,
// stopping at `root`. Returns null if not found.
function findAncestorTag(
  node: Node | null,
  tagName: string | string[],
  root: HTMLElement | null,
): HTMLElement | null {
  const upper = Array.isArray(tagName)
    ? tagName.map((t) => t.toUpperCase())
    : [tagName.toUpperCase()]
  let el: Node | null = node
  while (el && el !== root) {
    if (el.nodeType === Node.ELEMENT_NODE && upper.includes((el as HTMLElement).tagName)) {
      return el as HTMLElement
    }
    el = el.parentNode
  }
  return null
}

/**
 * Place the caret OUTSIDE an inline wrapper, immediately after it.
 *
 * `range.setStartAfter(el)` is not enough on its own: when `el` is the
 * last child of its parent, Chromium / WebKit still computes the
 * "typing style" from the inside-end of `el`, so the next typed
 * character (and any new paragraph created via Enter) inherits the
 * wrapper's formatting. Inserting a zero-width-space text node as a
 * sibling AFTER `el` and putting the caret INSIDE that text node moves
 * the caret physically out of `el`, which breaks the typing-style
 * inheritance and makes Enter split at the ZWSP boundary instead of
 * cloning the wrapper into the new block.
 *
 * The ZWSP is invisible and is stripped from the HTML before
 * conversion to markdown (see WysiwygEditor.tsx).
 */
function placeCaretOutsideAfter(el: HTMLElement) {
  const sel = window.getSelection()
  if (!sel) return
  const next = el.nextSibling
  let textNode: Text
  let offset: number
  if (next && next.nodeType === Node.TEXT_NODE) {
    // Reuse existing text node, prepend ZWSP so caret lives on a real
    // character outside the wrapper.
    const t = next as Text
    t.nodeValue = '​' + (t.nodeValue ?? '')
    textNode = t
    offset = 1
  } else {
    textNode = document.createTextNode('​')
    el.parentNode?.insertBefore(textNode, el.nextSibling)
    offset = 1
  }
  const r = document.createRange()
  r.setStart(textNode, offset)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
}

/**
 * Toggle an inline wrapper around the current selection. Behaviours:
 *
 *  - Collapsed selection → bail (don't toggle a "sticky" format state).
 *    This is the explicit fix for "underline/strike/inline-code shouldn't
 *    inherit": typing after a formatted run must not silently carry the
 *    style forward.
 *  - Selection inside an existing matching wrapper → unwrap it.
 *  - Otherwise → wrap, then place the caret AFTER the wrapper.
 *
 * `alsoMatch` lets bold/italic/strike toggle their alternate-tag form
 * (<b>, <i>, <s>) that may exist from older runs or pasted HTML.
 */
function toggleInlineWrap(wrapTag: string, alsoMatch: string[] = []) {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  if (sel.isCollapsed) return

  const existing = findAncestorTag(sel.anchorNode, [wrapTag, ...alsoMatch], _ceRoot)
  if (existing) {
    unwrapElement(existing)
    focusRoot()
    return
  }

  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const el = document.createElement(wrapTag)
  try {
    el.appendChild(range.extractContents())
    range.insertNode(el)
    // Caret in a ZWSP text node OUTSIDE the wrapper. `setStartAfter` is
    // not enough — when `el` is the last child of its parent, the
    // browser's "typing style" cache still treats the caret as inside
    // the wrapper, so the next typed char (and Enter-cloned paragraph)
    // inherits the formatting. The ZWSP boundary breaks that.
    placeCaretOutsideAfter(el)
  } catch {
    /* ignore — boundary errors on malformed ranges */
  }
  focusRoot()
}

export function htmlBold() { toggleInlineWrap('strong', ['b']) }
export function htmlItalic() { toggleInlineWrap('em', ['i']) }
export function htmlUnderline() { toggleInlineWrap('u') }
export function htmlStrikethrough() { toggleInlineWrap('del', ['s']) }

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
  toggleInlineWrap('code')
}

/**
 * Toggle a `<mark>` wrapper on the current selection. If `color` is provided
 * and no mark exists, the new mark is given an inline background style so it
 * can round-trip through raw-HTML markdown. If a mark already exists:
 *   - passing `color` replaces the existing color
 *   - passing no `color` (or `null`) removes the mark entirely.
 *
 * Same "no inheritance" contract as the wrap commands: collapsed
 * selection bails, the wrap is exactly the selected range, and the
 * caret lands AFTER the resulting `<mark>` so subsequent typing is
 * plain.
 */
export function htmlHighlight(color?: string | null) {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const existing = findAncestorTag(sel.anchorNode, 'mark', _ceRoot)

  if (existing) {
    if (color) {
      // Update color on existing mark.
      existing.style.background = color
      _lastHighlightMark = existing
      focusRoot()
      return
    }
    // No color → toggle off via unwrap (matches the strong/em/u/del
    // unwrap path; cursor lands after the previously-marked text).
    _lastHighlightMark = null
    unwrapElement(existing)
    // Move caret to the END of the selection so typing continues plain
    // text outside the (now-removed) mark.
    const sel2 = window.getSelection()
    if (sel2 && sel2.rangeCount > 0) {
      const r = sel2.getRangeAt(0).cloneRange()
      r.collapse(false)
      sel2.removeAllRanges(); sel2.addRange(r)
    }
    focusRoot()
    return
  }

  // No existing mark. Bail on collapsed selection — same anti-inheritance
  // rule as the wrap commands.
  if (sel.isCollapsed) return

  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const mark = document.createElement('mark')
  if (color) mark.style.background = color
  try {
    mark.appendChild(range.extractContents())
    range.insertNode(mark)
    _lastHighlightMark = mark
    // ZWSP boundary so typing after the highlight doesn't inherit it
    // (and Enter starts a fresh, unhighlighted paragraph).
    placeCaretOutsideAfter(mark)
  } catch {
    /* ignore — boundary errors on malformed ranges */
  }
  focusRoot()
}

/**
 * The most recently created (or recoloured) <mark> element. The
 * floating toolbar uses this to live-update the highlight colour as
 * the user drags the shade slider — after `htmlHighlight` wraps the
 * selection, the caret moves OUTSIDE the mark, so re-calling
 * `htmlHighlight` would no longer find it. This ref breaks that
 * dependency.
 */
let _lastHighlightMark: HTMLElement | null = null
export function getLastHighlightMark(): HTMLElement | null {
  return _lastHighlightMark
}

/** Returns the currently-active <mark> ancestor of the selection, or null. */
export function getActiveMark(): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return findAncestorTag(sel.anchorNode, 'mark', _ceRoot)
}

export async function htmlHyperlink() {
  if (!_ceRoot) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  // Save range before async dialog
  const range = sel.getRangeAt(0).cloneRange()
  const selectedText = sel.isCollapsed ? '' : sel.toString()

  // Detect if cursor is inside an existing <a>
  let existingA: HTMLAnchorElement | null = null
  let node: Node | null = sel.anchorNode
  while (node && node !== _ceRoot) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'A') {
      existingA = node as HTMLAnchorElement; break
    }
    node = node.parentNode
  }

  const { showLinkDialog } = await import('./linkDialog')
  const result = await showLinkDialog(
    selectedText || existingA?.textContent || '',
    existingA?.getAttribute('href') || '',
  )
  if (!result) { focusRoot(); return }

  _ceRoot.focus()
  sel.removeAllRanges()
  sel.addRange(range)

  if (existingA) {
    // Edit existing link in-place. Place caret AFTER the link so the
    // user typing more doesn't extend the anchor text.
    existingA.href = result.url
    if (result.text) existingA.textContent = result.text
    placeCaretOutsideAfter(existingA)
  } else if (!sel.isCollapsed) {
    // Wrap selected text in a fresh <a>. We avoid execCommand here for
    // the same reason as bold/italic — execCommand leaves the caret
    // INSIDE the new <a>, so the next typed character continues the
    // link. Build the anchor manually and put the caret after it.
    const a = document.createElement('a')
    a.href = result.url
    try {
      a.appendChild(range.extractContents())
      // Optionally rewrite the link text if the user changed it in the
      // dialog. We replace whatever was extracted with the new label.
      if (result.text && result.text !== selectedText) {
        a.textContent = result.text
      }
      range.insertNode(a)
      placeCaretOutsideAfter(a)
    } catch {
      /* ignore — boundary errors on malformed ranges */
    }
  } else {
    // No selection — insert new link node. Caret AFTER.
    const a = document.createElement('a')
    a.href = result.url
    a.textContent = result.text || result.url
    range.insertNode(a)
    placeCaretOutsideAfter(a)
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
// The new <li> contains exactly the selected text (or "任务" if the
// selection was empty), and the caret moves INTO the new item so the
// user can keep typing inside the task — typing outside the list is
// just a click away.
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
  const labelNode = document.createTextNode(' ' + text)
  li.appendChild(labelNode)
  ul.appendChild(li)
  range.deleteContents()
  range.insertNode(ul)
  // Caret at the end of the label text, inside the <li>.
  const r = document.createRange()
  r.setStart(labelNode, labelNode.nodeValue?.length ?? 0)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
  focusRoot()
}

// Insert a table with `rows` data rows and `cols` columns.
export function htmlTable(rows: number, cols: number) {
  if (!_ceRoot) return
  // Restore saved selection (lost when table picker was focused)
  if (!selectionInsideRoot()) {
    if (!restoreSelection()) {
      // No saved selection — place cursor at end
      _ceRoot.focus()
      const s = window.getSelection()
      if (s) {
        const r = document.createRange()
        r.selectNodeContents(_ceRoot)
        r.collapse(false)
        s.removeAllRanges()
        s.addRange(r)
      }
    }
  }
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

// Code block (<pre><code>…</code></pre>) — wraps exactly the selected
// text, no more no less, and drops the caret at the end of the new
// <code> so the user keeps typing inside the block.
export function htmlCodeBlock() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const text = sel.toString() || ''
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  // textContent below replaces the codeText node we put inside, so we
  // create a stable text node we can re-anchor to for caret placement.
  const codeText = document.createTextNode(text || '\u200B')
  code.appendChild(codeText)
  pre.appendChild(code)
  range.deleteContents()
  range.insertNode(pre)
  const r = document.createRange()
  r.setStart(codeText, codeText.nodeValue?.length ?? 0)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
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

// Image — pick from file system (Tauri) or prompt URL (browser)
export async function htmlImage() {
  if (!_ceRoot) return
  // Save selection before any async operation
  const sel = window.getSelection()
  let range: Range | null = null
  let altText = ''
  if (sel && sel.rangeCount > 0 && _ceRoot.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0).cloneRange()
    altText = sel.isCollapsed ? '' : sel.toString()
  }

  let url: string | null = null

  if ((window as any).__TAURI_INTERNALS__) {
    const dialog = await import('@tauri-apps/plugin-dialog')
    const result = await dialog.open({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'] }],
      multiple: false,
    })
    const filePath = typeof result === 'string' ? result : (result as any)?.path ?? null
    if (!filePath) { focusRoot(); return }
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    // If cachePath is configured, copy the picked image into the cache and
    // reference the cached copy, so the note survives even if the source moves.
    const { useAppStore } = await import('../stores/useAppStore')
    const cache = useAppStore.getState().settings.cachePath
    if (cache) {
      try {
        const { copyFile, createDir, pathExists } = await import('./filesystem')
        if (!(await pathExists(cache))) await createDir(cache)
        const base = filePath.split(/[\\/]/).pop() || 'image'
        const stamp = Date.now().toString(36)
        const cached = `${cache.replace(/[\\/]+$/, '')}/${stamp}_${base}`
        await copyFile(filePath, cached)
        url = convertFileSrc(cached)
      } catch (err) {
        console.error('Failed to cache image, using original path:', err)
        url = convertFileSrc(filePath)
      }
    } else {
      url = convertFileSrc(filePath)
    }
  } else {
    const { pickImageBrowser } = await import('./filesystem')
    url = await pickImageBrowser()
  }

  if (!url) { focusRoot(); return }

  // Restore selection
  _ceRoot.focus()
  if (range) {
    const s = window.getSelection()
    if (s) { s.removeAllRanges(); s.addRange(range) }
  }

  const img = document.createElement('img')
  img.src = url
  img.alt = altText || 'image'
  const finalSel = window.getSelection()
  if (finalSel && finalSel.rangeCount > 0) {
    const r = finalSel.getRangeAt(0)
    r.deleteContents()
    r.insertNode(img)
    // Place caret AFTER the image so the next typed character doesn't
    // accidentally land before it (some browsers leave the caret at
    // the start of the inserted node otherwise).
    const after = document.createRange()
    after.setStartAfter(img)
    after.collapse(true)
    finalSel.removeAllRanges()
    finalSel.addRange(after)
  }
  focusRoot()
}

/**
 * Clear inline formatting inside the current selection — and ONLY
 * inside it. The previous implementation walked the whole tree and
 * unwrapped any element that *intersected* the selection range, which
 * meant selecting half of a `<strong>` block and clicking "clear" would
 * also strip the formatting from the unselected half. The user
 * expectation is "selected → cleaned, unselected → untouched."
 *
 * Approach:
 *   1. Extract the selection range as a fragment (the actual selected
 *      slice — siblings outside stay put).
 *   2. Inside the fragment, recursively unwrap the inline-format tags
 *      we care about (strong/em/b/i/u/s/del/mark/code).
 *   3. Re-insert the cleaned fragment in place of the original
 *      selection. Because extractContents splits any wrapping tags at
 *      the selection boundary, the unselected halves stay wrapped.
 */
export function htmlClearFormat() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)

  const FORMAT_TAGS = new Set([
    'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'MARK', 'CODE',
    'FONT', // legacy execCommand color/font wrappers
  ])

  const stripIn = (root: Node) => {
    // Walk children first (depth-first) since unwrap-in-place mutates
    // siblings. Snapshot child list before recursing.
    const kids = Array.from(root.childNodes)
    for (const k of kids) {
      if (k.nodeType === Node.ELEMENT_NODE) stripIn(k)
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return
    const el = root as HTMLElement
    if (FORMAT_TAGS.has(el.tagName)) {
      const parent = el.parentNode
      if (!parent) return
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
      return
    }
    // For non-format elements (e.g. <span style="color:red">), strip
    // inline style/classes that execCommand-style tools leave behind.
    if (el.hasAttribute('style')) {
      el.style.color = ''
      el.style.background = ''
      el.style.backgroundColor = ''
      el.style.textDecoration = ''
      el.style.fontStyle = ''
      el.style.fontWeight = ''
      if (!el.getAttribute('style')) el.removeAttribute('style')
    }
  }

  // Snapshot endpoints before extracting (extract clears the range).
  const startContainer = range.startContainer
  const startOffset = range.startOffset

  const frag = range.extractContents()
  // Drop any Live Preview marker spans dragged into the fragment —
  // they're transient UI hints, not real content.
  frag.querySelectorAll && (frag as DocumentFragment).querySelectorAll('span.md-marker').forEach((m) => m.remove())
  stripIn(frag)

  // Re-insert at the original start point. After insert, normalize the
  // parent so adjacent text nodes from the split-points re-merge.
  range.setStart(startContainer, startOffset)
  range.collapse(true)
  // Re-acquire because frag insertion can invalidate references.
  range.insertNode(frag)
  if (startContainer.parentNode) (startContainer.parentNode as Element).normalize?.()

  // Place caret at the end of where the cleared content now sits.
  const end = document.createRange()
  end.setStart(range.endContainer, range.endOffset)
  end.collapse(true)
  sel.removeAllRanges()
  sel.addRange(end)
  focusRoot()
}

// Render a KaTeX HTML node for direct insertion into the WYSIWYG DOM.
// Falls back to a plain `$…$` text wrapper if KaTeX rejects the source
// so the user doesn't lose their input on a typo. Turndown's 'katex'
// rule round-trips both forms back to `$…$` / `$$…$$` markdown via
// the embedded <annotation> tag.
async function renderMathNode(tex: string, display: boolean): Promise<HTMLElement> {
  const { default: katex } = await import('katex')
  const wrapper = display
    ? document.createElement('div')
    : document.createElement('span')
  try {
    wrapper.innerHTML = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      output: 'html',
    })
    // Make the rendered math non-editable as a unit so users don't end
    // up navigating into the KaTeX-internal spans with arrow keys.
    wrapper.setAttribute('contenteditable', 'false')
    return wrapper
  } catch {
    wrapper.textContent = display ? `$$${tex}$$` : `$${tex}$`
    return wrapper
  }
}

// Inline math — opens the custom LaTeX dialog (live KaTeX preview) and
// inserts the rendered result inline. The wrapper is contenteditable=false
// so cursor navigation skips over it cleanly.
export async function htmlInlineMath() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0).cloneRange()
  const seed = sel.isCollapsed ? '' : sel.toString()

  const { showMathDialog } = await import('./mathDialog')
  const result = await showMathDialog(seed, /* display */ false)
  if (!result) { focusRoot(); return }

  _ceRoot?.focus()
  const s = window.getSelection()
  if (s) { s.removeAllRanges(); s.addRange(range) }

  const node = await renderMathNode(result.tex, result.display)
  if (result.display) {
    range.collapse(false)
    range.insertNode(node)
  } else {
    range.deleteContents()
    range.insertNode(node)
  }
  // Place cursor AFTER the inserted math node so typing continues plain.
  const after = document.createRange()
  after.setStartAfter(node)
  after.collapse(true)
  const sel2 = window.getSelection()
  if (sel2) { sel2.removeAllRanges(); sel2.addRange(after) }
  focusRoot()
}

// Math block — same dialog, default to block mode.
export async function htmlMathBlock() {
  if (!selectionInsideRoot()) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0).cloneRange()

  const { showMathDialog } = await import('./mathDialog')
  const result = await showMathDialog('\\int_0^1 x^2\\,dx', /* display */ true)
  if (!result) { focusRoot(); return }

  _ceRoot?.focus()
  const s = window.getSelection()
  if (s) { s.removeAllRanges(); s.addRange(range) }

  const node = await renderMathNode(result.tex, result.display)
  if (result.display) {
    range.collapse(false)
    range.insertNode(node)
  } else {
    range.deleteContents()
    range.insertNode(node)
  }
  const after = document.createRange()
  after.setStartAfter(node)
  after.collapse(true)
  const sel2 = window.getSelection()
  if (sel2) { sel2.removeAllRanges(); sel2.addRange(after) }
  focusRoot()
}
