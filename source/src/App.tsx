import { useAppStore } from './stores/useAppStore'
import { useTheme } from './hooks/useTheme'
import { useKeyboard } from './hooks/useKeyboard'
import { useAutosave } from './hooks/useAutosave'
import { useTypewriter } from './hooks/useTypewriter'
import { useWindowState } from './hooks/useWindowState'
import { MenuBar } from './components/MenuBar/MenuBar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { StatusBar } from './components/StatusBar/StatusBar'
import { SettingsModal } from './components/Settings/SettingsModal'
import { HelpModals } from './components/Help/HelpModals'
import { FindReplacePanel } from './components/FindReplace/FindReplacePanel'
import { TablePicker } from './components/TablePicker/TablePicker'
import { LinkDialog } from './components/LinkDialog/LinkDialog'
import styles from './App.module.css'

export default function App() {
  useTheme()
  useKeyboard()
  useAutosave()
  useTypewriter()
  useWindowState()

  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const focusMode = useAppStore((s) => s.focusMode)
  const zoom = useAppStore((s) => s.zoom)

  const showSidebar = sidebarVisible && !focusMode
  const sidebarCol = showSidebar ? `${sidebarWidth}px` : '0px'

  const appClass = focusMode
    ? `${styles.app} ${styles.focusMode}`
    : styles.app

  return (
    <>
      <div
        className={appClass}
        style={{
          '--sidebar-col': sidebarCol,
          '--zoom': `${zoom / 100}`,
        } as React.CSSProperties}
      >
        {!focusMode && <MenuBar />}
        {!focusMode && <Sidebar />}
        <Editor />
        {!focusMode && <StatusBar />}
      </div>
      <SettingsModal />
      <HelpModals />
      <FindReplacePanel />
      <TablePicker />
      <LinkDialog />
    </>
  )
}
