import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { SidebarTabs } from './SidebarTabs'
import { SearchBox } from './SearchBox'
import { FileTree } from './FileTree'
import { OutlineTree } from './OutlineTree'
import styles from './Sidebar.module.css'

const SCROLL_EDGE = 40   // px from edge to start auto-scroll
const SCROLL_SPEED = 8   // px per frame

export function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const [filter, setFilter] = useState('')
  const dragging = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number>(0)

  // ── Auto-scroll during drag near top/bottom edges ──
  const onContentDragOver = useCallback((e: React.DragEvent) => {
    const el = contentRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const y = e.clientY

    let direction = 0
    if (y - rect.top < SCROLL_EDGE) direction = -1      // near top → scroll up
    else if (rect.bottom - y < SCROLL_EDGE) direction = 1 // near bottom → scroll down

    if (direction !== 0 && !scrollRafRef.current) {
      const tick = () => {
        el.scrollBy(0, direction * SCROLL_SPEED)
        scrollRafRef.current = requestAnimationFrame(tick)
      }
      scrollRafRef.current = requestAnimationFrame(tick)
    } else if (direction === 0 && scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
  }, [])

  // Clean up on unmount
  useEffect(() => stopAutoScroll, [stopAutoScroll])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMouseMove = (ev: MouseEvent) => {
        if (dragging.current) {
          setSidebarWidth(ev.clientX)
        }
      }

      const onMouseUp = () => {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [setSidebarWidth]
  )

  return (
    <div className={styles.sidebar}>
      <SidebarTabs />
      <SearchBox value={filter} onChange={setFilter} />
      <div
        ref={contentRef}
        className={styles.content}
        onDragOver={onContentDragOver}
        onDragLeave={stopAutoScroll}
        onDrop={stopAutoScroll}
        onDragEnd={stopAutoScroll}
      >
        {activeTab === 'files' ? <FileTree filter={filter} /> : <OutlineTree filter={filter} />}
      </div>
      <div
        className={styles.resizeHandle}
        onMouseDown={onMouseDown}
      />
    </div>
  )
}
