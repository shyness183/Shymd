import { useEffect, useRef, useState } from 'react'
import styles from './PopoverMenu.module.css'

/**
 * One menu entry. Either a leaf (with `onClick`) or a submenu (with
 * `children`). `separator: true` renders a divider — other fields
 * ignored.
 */
export interface PopoverMenuItem {
  label?: string
  shortcut?: string
  checked?: boolean
  disabled?: boolean
  icon?: string
  separator?: boolean
  onClick?: () => void
  children?: PopoverMenuItem[]
}

interface PopoverMenuProps {
  items: PopoverMenuItem[]
  /** Position to anchor the menu (viewport coords). */
  x: number
  y: number
  /** Called when the menu wants to close (outside click, Esc, item click). */
  onClose: () => void
  /** Optional CSS class for outermost menu container (sub-menus inherit
   *  styling from this module regardless). */
  className?: string
}

const MENU_WIDTH = 240

/**
 * Generic popover / context menu with submenu support.
 *
 * Behaviour:
 *   - Hovering a row with `children` opens a sub-popover to the right.
 *   - Clicking a leaf item runs its `onClick` and closes everything.
 *   - Outside click or Escape closes.
 *   - Clamps to viewport edges (flips left / up if it would overflow).
 */
export function PopoverMenu({ items, x, y, onClose, className }: PopoverMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [submenuPos, setSubmenuPos] = useState<{ x: number; y: number } | null>(null)

  // Outside click + Escape → close.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    // Defer one tick so the very click that opened us doesn't close us.
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Clamp horizontal: flip left if it would overflow the viewport.
  const clampedX = Math.min(x, window.innerWidth - MENU_WIDTH - 8)
  // Vertical: estimate height by row count, flip up if it would overflow.
  const estHeight = Math.min(420, 12 + items.length * 32)
  const clampedY = y + estHeight > window.innerHeight
    ? Math.max(8, window.innerHeight - estHeight - 8)
    : y

  const runItem = (item: PopoverMenuItem) => {
    if (item.disabled) return
    if (item.children) return // submenu — don't close on parent click
    item.onClick?.()
    onClose()
  }

  const onRowMouseEnter = (idx: number, item: PopoverMenuItem, ev: React.MouseEvent) => {
    setHoverIdx(idx)
    if (item.children) {
      const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
      setSubmenuPos({ x: rect.right - 4, y: rect.top })
    } else {
      setSubmenuPos(null)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.menu} ${className ?? ''}`}
      style={{ left: clampedX, top: clampedY, width: MENU_WIDTH }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className={styles.separator} />
        const active = hoverIdx === i
        return (
          <button
            key={i}
            type="button"
            className={`${styles.row}${active ? ' ' + styles.rowActive : ''}${item.disabled ? ' ' + styles.rowDisabled : ''}`}
            disabled={item.disabled}
            onMouseEnter={(e) => onRowMouseEnter(i, item, e)}
            onClick={() => runItem(item)}
          >
            <span className={styles.check}>{item.checked ? '✓' : item.icon ?? ''}</span>
            <span className={styles.label}>{item.label}</span>
            {item.children
              ? <span className={styles.chevron}>▸</span>
              : item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
          </button>
        )
      })}
      {hoverIdx !== null && submenuPos && items[hoverIdx]?.children && (
        <PopoverMenu
          items={items[hoverIdx].children!}
          x={submenuPos.x}
          y={submenuPos.y}
          onClose={onClose}
        />
      )}
    </div>
  )
}
