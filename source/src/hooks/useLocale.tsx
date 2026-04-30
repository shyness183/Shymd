import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

type Locale = 'zh-CN' | 'en-US'
type Messages = Record<string, string>

const locales: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue>(null!)

function loadLocale(): Locale {
  try {
    const raw = localStorage.getItem('shymd-locale')
    if (raw === 'en-US' || raw === 'zh-CN') return raw
  } catch { /* quota / private mode */ }
  return 'zh-CN'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try { localStorage.setItem('shymd-locale', next) } catch { /* ignore */ }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let msg = locales[locale][key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          msg = msg.replace(`{${k}}`, String(v))
        }
      }
      return msg
    },
    [locale]
  )

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
