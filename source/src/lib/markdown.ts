import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
// @ts-expect-error markdown-it-texmath has no types
import texmath from 'markdown-it-texmath'
import katex from 'katex'
// @ts-expect-error no types
import markdownItMark from 'markdown-it-mark'
// @ts-expect-error no types
import markdownItFootnote from 'markdown-it-footnote'
// @ts-expect-error no types
import markdownItTaskLists from 'markdown-it-task-lists'

let mermaidIdCounter = 0

export const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    // Mermaid code blocks → special container for post-render
    if (lang === 'mermaid') {
      const id = `mermaid-${++mermaidIdCounter}`
      return `<div class="mermaid-block" id="${id}">${md.utils.escapeHtml(str)}</div>`
    }

    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {
        // fall through
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

md.enable('strikethrough')
md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false },
})
md.use(markdownItMark)
md.use(markdownItFootnote)
md.use(markdownItTaskLists, { enabled: true })

// ── YAML Front Matter support ──
// Strips ---...--- front matter from the beginning of the document
md.use((mdInstance: MarkdownIt) => {
  mdInstance.block.ruler.before('hr', 'front_matter', (state, startLine, _endLine, silent) => {
    // Only at the very beginning of the document
    if (startLine !== 0) return false
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const marker = state.src.slice(start, max).trim()
    if (marker !== '---') return false

    let nextLine = startLine + 1
    while (nextLine < state.lineMax) {
      const s = state.bMarks[nextLine] + state.tShift[nextLine]
      const e = state.eMarks[nextLine]
      const line = state.src.slice(s, e).trim()
      if (line === '---') {
        if (silent) return true
        const token = state.push('front_matter', '', 0)
        token.content = state.src.slice(
          state.bMarks[startLine + 1],
          state.bMarks[nextLine]
        )
        token.map = [startLine, nextLine + 1]
        state.line = nextLine + 1
        return true
      }
      nextLine++
    }
    return false
  })

  mdInstance.renderer.rules['front_matter'] = (tokens, idx) => {
    const content = tokens[idx].content.trim()
    return `<div class="front-matter"><pre><code class="language-yaml">${mdInstance.utils.escapeHtml(content)}</code></pre></div>`
  }
})

// ── [TOC] support ──
md.use((mdInstance: MarkdownIt) => {
  // Inline rule: replace [TOC] with a placeholder token
  mdInstance.inline.ruler.after('text', 'toc_placeholder', (state, silent) => {
    const src = state.src.slice(state.pos)
    const match = src.match(/^\[TOC\]/i)
    if (!match) return false
    if (silent) return true
    const token = state.push('toc_placeholder', '', 0)
    token.content = ''
    state.pos += match[0].length
    return true
  })

  mdInstance.renderer.rules['toc_placeholder'] = () => {
    return '<nav class="toc-placeholder" data-toc="true"></nav>'
  }
})

// ── Mermaid post-render ──

let mermaidReady: Promise<typeof import('mermaid')> | null = null

function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
      })
      return m
    })
  }
  return mermaidReady
}

/**
 * Call after inserting rendered HTML into the DOM.
 * Finds .mermaid-block elements and renders them as SVG diagrams.
 */
export async function renderMermaidBlocks(container: HTMLElement) {
  const blocks = container.querySelectorAll<HTMLElement>('.mermaid-block')
  if (blocks.length === 0) return

  const mermaid = await getMermaid()
  for (const block of blocks) {
    const code = block.textContent || ''
    if (!code.trim()) continue
    try {
      const { svg } = await mermaid.default.render(block.id || `mermaid-${++mermaidIdCounter}`, code)
      block.innerHTML = svg
      block.classList.add('mermaid-rendered')
    } catch {
      block.classList.add('mermaid-error')
      block.textContent = code // Show raw code on error
    }
  }
}

/**
 * Generate a table of contents from headings and inject into [TOC] placeholders.
 */
export function injectTOC(container: HTMLElement) {
  const placeholders = container.querySelectorAll<HTMLElement>('.toc-placeholder')
  if (placeholders.length === 0) return

  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  if (headings.length === 0) {
    placeholders.forEach((p) => (p.innerHTML = ''))
    return
  }

  const items = Array.from(headings).map((h) => {
    const level = parseInt(h.tagName[1])
    const text = h.textContent || ''
    const id = h.id || text.replace(/\s+/g, '-').toLowerCase()
    if (!h.id) h.id = id
    return `<li class="toc-level-${level}"><a href="#${id}">${md.utils.escapeHtml(text)}</a></li>`
  })

  const html = `<ul class="toc-list">${items.join('')}</ul>`
  placeholders.forEach((p) => (p.innerHTML = html))
}
