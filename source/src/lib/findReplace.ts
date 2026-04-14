// Non-destructive text find/replace for the WYSIWYG and reading surfaces.
// Uses the CSS Custom Highlight API to highlight matches without mutating
// the DOM for find, and only mutates text nodes on replace.

import { getCERoot } from './htmlEditorCommands'

export interface FindOptions {
  caseSensitive?: boolean
}

export interface FindMatch {
  range: Range
  // Snapshot of the text-node info so we can perform replaces later.
  node: Text
  start: number
  end: number
}

const HIGHLIGHT_ALL = 'shymd-find'
const HIGHLIGHT_CURRENT = 'shymd-find-current'

/**
 * Locate the current visible editor content root. For WYSIWYG it's the
 * registered contentEditable root; for reading it's the element tagged with
 * `data-find-root="true"`.
 */
export function getFindRoot(): HTMLElement | null {
  const ce = getCERoot()
  if (ce) return ce
  const el = document.querySelector<HTMLElement>('[data-find-root="true"]')
  return el
}

/** Collect all text matches under `root` for the given query. */
export function collectMatches(
  root: HTMLElement,
  query: string,
  opts: FindOptions = {},
): FindMatch[] {
  if (!query) return []
  const matches: FindMatch[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip empty and script/style content
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const cs = !!opts.caseSensitive
  const needle = cs ? query : query.toLowerCase()
  const nLen = needle.length
  if (nLen === 0) return []

  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.nodeValue || ''
    const hay = cs ? text : text.toLowerCase()
    let idx = 0
    while ((idx = hay.indexOf(needle, idx)) !== -1) {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + nLen)
      matches.push({
        range,
        node: node as Text,
        start: idx,
        end: idx + nLen,
      })
      idx += nLen
    }
  }
  return matches
}

/** Apply highlight styling to all matches, with the current one emphasized. */
export function applyHighlights(matches: FindMatch[], currentIdx: number) {
  // Not all browsers have CSS.highlights (e.g. older Safari). Degrade
  // silently — the caller still uses scrollIntoView to locate matches.
  // Use a structural check to avoid touching `CSS` when it lacks
  // `.highlights` in older environments.
  const cssAny = (window as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS
  if (!cssAny?.highlights) return
  try {
    const all = new Highlight(...matches.filter((_, i) => i !== currentIdx).map((m) => m.range))
    const cur = new Highlight(...(matches[currentIdx] ? [matches[currentIdx].range] : []))
    cssAny.highlights.set(HIGHLIGHT_ALL, all)
    cssAny.highlights.set(HIGHLIGHT_CURRENT, cur)
  } catch {
    /* noop */
  }
}

export function clearHighlights() {
  const cssAny = (window as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS
  if (!cssAny?.highlights) return
  cssAny.highlights.delete(HIGHLIGHT_ALL)
  cssAny.highlights.delete(HIGHLIGHT_CURRENT)
}

export function scrollMatchIntoView(match: FindMatch) {
  const rect = match.range.getBoundingClientRect()
  const vh = window.innerHeight
  if (rect.top < 80 || rect.bottom > vh - 80) {
    // Scroll the ancestor scroller
    const span = document.createElement('span')
    match.range.insertNode(span)
    span.scrollIntoView({ block: 'center', behavior: 'smooth' })
    span.remove()
  }
}

/**
 * Replace the text at the current match with `replacement`. Mutates the
 * backing text node. After mutation the existing match list is invalid —
 * caller should re-collect matches.
 */
export function replaceMatch(match: FindMatch, replacement: string) {
  const node = match.node
  const text = node.nodeValue || ''
  const next = text.slice(0, match.start) + replacement + text.slice(match.end)
  node.nodeValue = next
}

/**
 * Replace all matches for `query` under `root`. Walks matches
 * back-to-front so earlier offsets remain valid. Returns the replace count.
 */
export function replaceAll(
  root: HTMLElement,
  query: string,
  replacement: string,
  opts: FindOptions = {},
): number {
  const matches = collectMatches(root, query, opts)
  for (let i = matches.length - 1; i >= 0; i--) {
    replaceMatch(matches[i], replacement)
  }
  return matches.length
}
