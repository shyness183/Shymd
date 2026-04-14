import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'

export function useTheme() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const apply = (t: string) => {
      if (t === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light'
      } else {
        document.documentElement.dataset.theme = t
      }
    }
    apply(theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  return theme
}
