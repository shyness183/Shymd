import TurndownService from 'turndown'

/** Shared TurndownService singleton configured for WYSIWYG↔markdown round-trip. */
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
})

// Empty inline wrappers — return '' so `<strong></strong>` doesn't become
// `****` which markdown-it then renders as a horizontal rule.
turndown.addRule('emptyInline', {
  filter: (node) => {
    const el = node as HTMLElement
    const tags = ['STRONG', 'B', 'EM', 'I', 'U', 'DEL', 'S', 'MARK', 'CODE']
    return tags.includes(el.tagName) && !(el.textContent || '').replace(/​/g, '').trim()
  },
  replacement: () => '',
})

// GFM strikethrough
turndown.addRule('strikethrough', {
  filter: ['del', 's'] as any,
  replacement: (content) => `~~${content}~~`,
})

// Underline — preserve <u> as raw HTML
turndown.addRule('underline', {
  filter: ['u'] as any,
  replacement: (content) => `<u>${content}</u>`,
})

// Highlight (mark) — colored marks keep raw HTML; plain → `==text==`
turndown.addRule('highlight', {
  filter: ['mark'] as any,
  replacement: (content, node) => {
    const el = node as HTMLElement
    const bg = el.style?.background || el.style?.backgroundColor
    if (bg) return `<mark style="background:${bg}">${content}</mark>`
    return `==${content}==`
  },
})

// Task list items
turndown.addRule('taskListItem', {
  filter: (node) =>
    node.nodeName === 'LI' && !!node.querySelector('input[type="checkbox"]'),
  replacement: (_content, node) => {
    const el = node as HTMLElement
    const cb = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const checked = cb?.checked ? 'x' : ' '
    const clone = el.cloneNode(true) as HTMLElement
    const cc = clone.querySelector('input[type="checkbox"]')
    if (cc) cc.remove()
    const text = clone.textContent?.trim() || ''
    return `- [${checked}] ${text}\n`
  },
})

// KaTeX: convert rendered math back to $…$ / $$…$$
turndown.addRule('katex', {
  filter: (node) => {
    const el = node as HTMLElement
    return el.classList?.contains('katex') || el.tagName === 'EQ' || el.tagName === 'EQN'
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement
    const ann = el.querySelector('annotation[encoding="application/x-tex"]')
    const tex = ann?.textContent || el.textContent || ''
    const block = el.tagName === 'EQN' || el.classList?.contains('katex-display')
    return block ? `\n\n$$${tex}$$\n\n` : `$${tex}$`
  },
})

// Fenced code blocks
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

// Mermaid blocks
turndown.addRule('mermaidBlock', {
  filter: (node) => (node as HTMLElement).classList?.contains('mermaid-block') === true,
  replacement: (_content, node) => {
    const el = node as HTMLElement
    const svg = el.querySelector('svg')
    const code = svg ? (el.getAttribute('data-source') || '') : (el.textContent || '')
    return '\n\n```mermaid\n' + code.trim() + '\n```\n\n'
  },
})

// Images — use <angle brackets> for URLs with parentheses
turndown.addRule('image', {
  filter: 'img',
  replacement: (_content, node) => {
    const el = node as HTMLImageElement
    const alt = (el.getAttribute('alt') || '').replace(/[\[\]]/g, '')
    const src = el.getAttribute('data-raw-src') || el.getAttribute('src') || ''
    if (!src) return ''
    const title = el.getAttribute('title') || ''
    const needsAngle = /[()\s]/.test(src)
    const srcPart = needsAngle ? `<${src}>` : src
    const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : ''
    return `![${alt}](${srcPart}${titlePart})`
  },
})

// GFM pipe tables
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
turndown.addRule('tableParts', {
  filter: ['thead', 'tbody', 'tr', 'th', 'td'] as any,
  replacement: (content) => content,
})

// YAML Front Matter
turndown.addRule('frontMatter', {
  filter: (node) => (node as HTMLElement).classList?.contains('front-matter') === true,
  replacement: (_content, node) => {
    const code = (node as HTMLElement).querySelector('code')
    const text = code?.textContent || ''
    return '---\n' + text.trim() + '\n---\n\n'
  },
})

export { turndown }
