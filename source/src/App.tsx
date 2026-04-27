import { useAppStore } from './stores/useAppStore'
import { useTheme } from './hooks/useTheme'
import { useKeyboard } from './hooks/useKeyboard'
import { useAutosave } from './hooks/useAutosave'
import { useTypewriter } from './hooks/useTypewriter'
import { useWindowState } from './hooks/useWindowState'
import { useInitialLoad } from './hooks/useInitialLoad'
import { TitleBar } from './components/TopBar/TitleBar'
import { Toolbar } from './components/TopBar/Toolbar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { StatusBar } from './components/StatusBar/StatusBar'
import { SettingsModal } from './components/Settings/SettingsModal'
import { HelpModals } from './components/Help/HelpModals'
import { FindReplacePanel } from './components/FindReplace/FindReplacePanel'
import { TablePicker } from './components/TablePicker/TablePicker'
import { LinkDialog } from './components/LinkDialog/LinkDialog'
import { MathDialog } from './components/MathDialog/MathDialog'
import { SlashMenu } from './components/SlashMenu/SlashMenu'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog/ConfirmDeleteDialog'
import { EditorContextMenu } from './components/EditorContextMenu/EditorContextMenu'
import { ToastHost } from './components/Toast/Toast'
import { useLaunchFile } from './hooks/useLaunchFile'
import styles from './App.module.css'

export default function App() {
  useTheme()
  useKeyboard()
  useAutosave()
  useTypewriter()
  useWindowState()
  useInitialLoad()
  useLaunchFile()

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
        {!focusMode && <TitleBar />}
        {!focusMode && <Toolbar />}
        {!focusMode && <Sidebar />}
        <Editor />
        {!focusMode && <StatusBar />}
      </div>
      <SettingsModal />
      <HelpModals />
      <FindReplacePanel />
      <TablePicker />
      <LinkDialog />
      <MathDialog />
      <SlashMenu />
      <ConfirmDeleteDialog />
      <EditorContextMenu />
      <ToastHost />
    </>
  )
}
