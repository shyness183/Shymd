import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { getCERoot } from '../lib/htmlEditorCommands'
import { getEditorView } from '../lib/editorCommands'

/**
 * Typewriter mode: keeps the active caret roughly vertically centered
 * in the scrollable editor area. Works for source (CodeMirror) and
 * wysiwyg (contentEditable) modes. No-op in reading mode.
 */
export function useTypewriter() {
  const enabled = useAppStore((s) => s.typewriterMode)
  const editorMode = useAppStore((s) => s.editorMode)

  useEffect(() => {
    if (!enabled) return
    if (editorMode === 'reading') return

    const findScroller = (): HTMLElement | null => {
      if (editorMode === 'source') {
        return document.querySelector<HTMLElement>('.cm-scroller')
      }
      // wysiwyg: the .editor wrapper (which has overflow-y: auto)
      const root = getCERoot()
      let el: HTMLElement | null = root?.parentElement ?? null
      while (el) {
        const cs = getComputedStyle(el)
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return el
        el = el.parentElement
      }
      return null
    }

    let rafId = 0
    const center = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const scroller = findScroller()
        if (!scroller) return

        let caretY = 0
        if (editorMode === 'source') {
          const view = getEditorView()
          if (!view) return
          const head = view.state.selection.main.head
          const coords = view.coordsAtPos(head)
          if (!coords) return
          const scRect = scroller.getBoundingClientRect()
          caretY = coords.top - scRect.top + scroller.scrollTop
        } else {
          const sel = window.getSelection()
          if (!sel || sel.rangeCount === 0) return
          const range = sel.getRangeAt(0).cloneRange()
          range.collapse(true)
          let rect = range.getBoundingClientRect()
          // Collapsed ranges can return zero-rect; insert a temporary span.
          if (rect.top === 0 && rect.bottom === 0) {
            const span = document.createElement('span')
            span.textContent = '\u200b'
            range.insertNode(span)
            rect = span.getBoundingClientRect()
            span.remove()
          }
          const scRect = scroller.getBoundingClientRect()
          caretY = rect.top - scRect.top + scroller.scrollTop
        }

        const target = caretY - scroller.clientHeight / 2
        scroller.scrollTo({ top: target, behavior: 'smooth' })
      })
    }

    const onSelect = () => {
      // Only center when the selection is actually inside our editor —
      // `selectionchange` fires for everywhere (sidebar clicks, etc.).
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const anchor = sel.anchorNode
        if (editorMode === 'source') {
          const view = getEditorView()
          if (!view || !anchor || !view.dom.contains(anchor)) return
        } else {
          const root = getCERoot()
          if (!root || !anchor || !root.contains(anchor)) return
        }
      }
      center()
    }
    const onInput = () => center()

    document.addEventListener('selectionchange', onSelect)
    document.addEventListener('keyup', onInput)
    // Initial center
    center()

    return () => {
      document.removeEventListener('selectionchange', onSelect)
      document.removeEventListener('keyup', onInput)
      cancelAnimationFrame(rafId)
    }
  }, [enabled, editorMode])
}
