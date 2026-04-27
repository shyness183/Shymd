import type { AppSettings } from '../types'

const STORAGE_KEY = 'shymd-settings'

export const defaultSettings: AppSettings = {
  fileStoragePath: '',
  downloadPath: '',
  cachePath: '',
  autoSave: true,
  autoSaveDelay: 1000,
  spellcheck: false,
  imageStoragePath: '',
  // Default OFF — right-click context menu is the primary path now.
  floatingToolbarEnabled: false,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...defaultSettings, ...JSON.parse(raw) }
    }
  } catch {
    // ignore
  }
  return { ...defaultSettings }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

/**
 * Check if a specific path setting is configured.
 * Returns true if the path is non-empty.
 */
export function isPathConfigured(key: 'fileStoragePath' | 'downloadPath' | 'cachePath'): boolean {
  const settings = loadSettings()
  return !!settings[key]
}
