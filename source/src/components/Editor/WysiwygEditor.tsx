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

  const onInput = () => {
    scheduleSave()
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
      />
    </div>
  )
}
