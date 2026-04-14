import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './ContextMenu.module.css'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  separator?: boolean
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Clamp position to viewport
  const clampedX = Math.min(x, window.innerWidth - 180)
  const clampedY = Math.min(y, window.innerHeight - items.length * 32 - 16)

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      style={{ left: clampedX, top: clampedY }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className={styles.separator} />
        ) : (
          <button
            key={i}
            className={`${styles.item} ${item.danger ? styles.danger : ''}`}
            onClick={() => {
              item.onClick()
              onClose()
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>,
    document.body
  )
}
