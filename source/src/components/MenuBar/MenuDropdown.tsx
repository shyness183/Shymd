import { useState, useRef, useEffect } from 'react'
import styles from './MenuDropdown.module.css'

export interface MenuItem {
  label: string
  shortcut?: string
  checked?: boolean
  separator?: boolean
  onClick?: () => void
}

interface Props {
  label: string
  items: MenuItem[]
}

export function MenuDropdown({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>

      {open && (
        <div className={styles.dropdown}>
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} className={styles.separator} />
            ) : (
              <button
                key={i}
                className={styles.item}
                onClick={() => {
                  item.onClick?.()
                  setOpen(false)
                }}
              >
                <span>
                  {item.checked !== undefined && (
                    <span className={styles.check}>
                      {item.checked ? '✓' : '\u2003'}
                    </span>
                  )}
                  {item.label}
                </span>
                {item.shortcut && (
                  <span className={styles.shortcut}>{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
