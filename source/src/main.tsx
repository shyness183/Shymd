import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/variables.css'
import './styles/reset.css'
import './styles/typography.css'
import './styles/hljs-theme.css'
import 'katex/dist/katex.min.css'
import 'markdown-it-texmath/css/texmath.css'
import { LocaleProvider } from './hooks/useLocale.tsx'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
