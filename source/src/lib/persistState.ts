import type { FileNode } from '../types'

const KEY = 'shymd-session-v1'

export interface PersistedSession {
  files: FileNode[]
  activeFile: string
  doc: string
  savedAt: number
}

export function savePersistedSession(s: PersistedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // quota exceeded or disabled — ignore
  }
}

export function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed || !Array.isArray(parsed.files)) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPersistedSession(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
