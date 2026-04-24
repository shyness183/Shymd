import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './Toast.module.css'

type ToastKind = 'info' | 'warn' | 'error'
interface ToastMsg {
  id: number
  text: string
  kind: ToastKind
}

let counter = 0
const listeners = new Set<(msgs: ToastMsg[]) => void>()
let queue: ToastMsg[] = []

function emit() {
  for (const fn of listeners) fn([...queue])
}

export function showToast(text: string, kind: ToastKind = 'info', durationMs = 3500) {
  const id = ++counter
  queue.push({ id, text, kind })
  emit()
  window.setTimeout(() => {
    queue = queue.filter((m) => m.id !== id)
    emit()
  }, durationMs)
}

export function ToastHost() {
  const [msgs, setMsgs] = useState<ToastMsg[]>([])
  useEffect(() => {
    listeners.add(setMsgs)
    return () => {
      listeners.delete(setMsgs)
    }
  }, [])
  if (msgs.length === 0) return null
  return createPortal(
    <div className={styles.host}>
      {msgs.map((m) => (
        <div key={m.id} className={`${styles.toast} ${styles[m.kind]}`}>
          {m.text}
        </div>
      ))}
    </div>,
    document.body,
  )
}
