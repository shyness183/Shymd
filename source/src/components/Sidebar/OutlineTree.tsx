import { useMemo, useState, useCallback } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { getEditorView } from '../../lib/editorCommands'
import styles from './OutlineTree.module.css'

interface Heading {
  text: string
  level: number
  lineIndex: number // line number in the doc (0-based)
}

interface OutlineNode {
  heading: Heading
  children: OutlineNode[]
}

function parseHeadings(doc: string): Heading[] {
  const lines = doc.split('\n')
  const headings: Heading[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      headings.push({
        text: match[2].trim(),
        level: match[1].length,
        lineIndex: i,
      })
    }
  }
  return headings
}

function buildTree(headings: Heading[]): OutlineNode[] {
  const root: OutlineNode[] = []
  const stack: { node: OutlineNode; level: number }[] = []

  for (const h of headings) {
    const node: OutlineNode = { heading: h, children: [] }

    // Pop stack until we find a parent with lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      stack[stack.length - 1].node.children.push(node)
    }
    stack.push({ node, level: h.level })
  }

  return root
}

function scrollToLine(lineIndex: number) {
  const view = getEditorView()
  if (view) {
    const line = view.state.doc.line(lineIndex + 1) // 1-based
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 50 }),
    })
    view.focus()
    return
  }

  // Fallback for wysiwyg/reading mode: scroll the editor container
  const editorEl = document.querySelector('[class*="editor"]')
  if (!editorEl) return

  // Find matching heading element in the rendered content
  const headings = editorEl.querySelectorAll('h1, h2, h3, h4, h5, h6')
  // We need to find the heading by counting from the doc
  const doc = useAppStore.getState().doc
  const lines = doc.split('\n')
  let headingCount = 0
  for (let i = 0; i <= lineIndex; i++) {
    if (lines[i].match(/^#{1,6}\s+/)) {
      headingCount++
    }
  }
  const targetEl = headings[headingCount - 1]
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Need EditorView import for scrollIntoView
import { EditorView } from '@codemirror/view'

interface OutlineItemProps {
  node: OutlineNode
  filter: string
  depth: number
}

function matchesFilter(node: OutlineNode, filter: string): boolean {
  if (!filter) return true
  if (node.heading.text.toLowerCase().includes(filter.toLowerCase())) return true
  return node.children.some((c) => matchesFilter(c, filter))
}

function OutlineItem({ node, filter, depth }: OutlineItemProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  const handleClick = useCallback(() => {
    scrollToLine(node.heading.lineIndex)
  }, [node.heading.lineIndex])

  if (!matchesFilter(node, filter)) return null

  const levelClass = styles[`h${node.heading.level}`] || ''

  return (
    <>
      <div
        className={`${styles.item} ${levelClass}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <span
            className={styles.arrow}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className={styles.dot}>•</span>
        )}
        <span className={styles.text}>{node.heading.text}</span>
      </div>
      {expanded &&
        node.children.map((child, i) => (
          <OutlineItem key={i} node={child} filter={filter} depth={depth + 1} />
        ))}
    </>
  )
}

export function OutlineTree({ filter = '' }: { filter?: string }) {
  const doc = useAppStore((s) => s.doc)
  const headings = useMemo(() => parseHeadings(doc), [doc])
  const tree = useMemo(() => buildTree(headings), [headings])

  const filteredTree = filter
    ? tree.filter((node) => matchesFilter(node, filter))
    : tree

  return (
    <div className={styles.tree}>
      {filteredTree.length === 0 ? (
        <div className={styles.empty}>{filter ? '无匹配标题' : '无标题'}</div>
      ) : (
        filteredTree.map((node, i) => (
          <OutlineItem key={i} node={node} filter={filter} depth={0} />
        ))
      )}
    </div>
  )
}
