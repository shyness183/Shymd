import { useRef, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { PopoverMenu, type PopoverMenuItem } from '../PopoverMenu/PopoverMenu'
import {
  exportHTML, saveMarkdown, saveMarkdownAs, openMarkdown, openFolder, newFile,
} from '../../lib/fileActions'
import { cmdFind, cmdReplace } from '../../lib/editorCommands'
import { isTauri } from '../../lib/filesystem'
import styles from './Toolbar.module.css'

/**
 * Row 2, column 2 — the EDITOR-side toolbar.
 *
 *   [filename ×] [+]                                            [⋮]
 *
 * Tab + new-file moved here from row 1 per user feedback. The 编辑/阅读
 * quick toggle was deleted — the status bar already shows current mode.
 *
 * The kebab `⋮` carries every command that used to live in the legacy
 * 文件 / 编辑 / 段落 / 格式 / 视图 / 主题 / 帮助 menubar.
 */
export function Toolbar() {
  const { t, locale, setLocale } = useLocale()
  const editorMode = useAppStore((s) => s.editorMode)
  const setEditorMode = useAppStore((s) => s.setEditorMode)
  const activeFile = useAppStore((s) => s.activeFile)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const setHelpModal = useAppStore((s) => s.setHelpModal)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const focusMode = useAppStore((s) => s.focusMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const typewriterMode = useAppStore((s) => s.typewriterMode)
  const toggleTypewriterMode = useAppStore((s) => s.toggleTypewriterMode)
  const zoomIn = useAppStore((s) => s.zoomIn)
  const zoomOut = useAppStore((s) => s.zoomOut)
  const zoomReset = useAppStore((s) => s.zoomReset)
  const recentFiles = useAppStore((s) => s.recentFiles)
  const openFileByPath = useAppStore((s) => s.openFileByPath)
  const openFileByAbsolutePath = useAppStore((s) => s.openFileByAbsolutePath)
  const clearRecentFiles = useAppStore((s) => s.clearRecentFiles)
  const activeAbsolutePath = useAppStore((s) => s.activeAbsolutePath)

  // ── Kebab dropdown — every legacy command, with submenus ──
  const kebabBtnRef = useRef<HTMLButtonElement>(null)
  const [kebabOpen, setKebabOpen] = useState(false)
  const [kebabAnchor, setKebabAnchor] = useState<{ x: number; y: number } | null>(null)
  const openKebab = () => {
    if (!kebabBtnRef.current) return
    const r = kebabBtnRef.current.getBoundingClientRect()
    setKebabAnchor({ x: r.right - 240, y: r.bottom + 4 })
    setKebabOpen(true)
  }

  const dispatchFind = () => {
    if (editorMode === 'source') cmdFind()
    else useAppStore.getState().setFindOpen(true, 'find')
  }
  const dispatchReplace = () => {
    if (editorMode === 'source') cmdReplace()
    else useAppStore.getState().setFindOpen(true, 'replace')
  }

  const copyPath = () => {
    if (activeAbsolutePath) navigator.clipboard?.writeText(activeAbsolutePath).catch(() => {})
  }
  const openWithDefault = async () => {
    if (!isTauri() || !activeAbsolutePath) return
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener')
      await openPath(activeAbsolutePath)
    } catch (e) { console.error(e) }
  }
  const showInExplorer = async () => {
    if (!isTauri() || !activeAbsolutePath) return
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(activeAbsolutePath)
    } catch (e) { console.error(e) }
  }

  const recentSubmenu: PopoverMenuItem[] = recentFiles.length > 0
    ? [
        ...recentFiles.map((entry): PopoverMenuItem => ({
          label: entry.name,
          onClick: () => {
            if (entry.absolutePath) void openFileByAbsolutePath(entry.absolutePath)
            else if (entry.path.length > 0) void openFileByPath(entry.path)
          },
        })),
        { separator: true },
        { label: t('menu.file.clearRecent'), onClick: clearRecentFiles },
      ]
    : [{ label: t('menu.file.recent') + ' (∅)', disabled: true }]

  const kebabItems: PopoverMenuItem[] = [
    {
      label: t('menu.file'),
      children: [
        { label: t('menu.file.new'), shortcut: 'Ctrl+N', onClick: newFile },
        { label: t('menu.file.open'), shortcut: 'Ctrl+O', onClick: openMarkdown },
        { label: t('menu.file.openFolder'), shortcut: 'Ctrl+Shift+O', onClick: openFolder },
        { separator: true },
        { label: t('menu.file.save'), shortcut: 'Ctrl+S', onClick: saveMarkdown },
        { label: t('menu.file.saveAs'), shortcut: 'Ctrl+Shift+S', onClick: saveMarkdownAs },
        { separator: true },
        { label: t('menu.file.recent'), children: recentSubmenu },
        { separator: true },
        { label: t('menu.file.exportHtml'), onClick: exportHTML },
        { label: '导出为 PDF', onClick: () => window.print() },
      ],
    },
    {
      label: t('menu.edit'),
      children: [
        { label: t('menu.edit.undo'), shortcut: 'Ctrl+Z', onClick: () => document.execCommand('undo') },
        { label: t('menu.edit.redo'), shortcut: 'Ctrl+Shift+Z', onClick: () => document.execCommand('redo') },
        { separator: true },
        { label: t('menu.edit.cut'), shortcut: 'Ctrl+X', onClick: () => document.execCommand('cut') },
        { label: t('menu.edit.copy'), shortcut: 'Ctrl+C', onClick: () => document.execCommand('copy') },
        { label: t('menu.edit.paste'), shortcut: 'Ctrl+V', onClick: () => document.execCommand('paste') },
        { label: t('menu.edit.selectAll'), shortcut: 'Ctrl+A', onClick: () => document.execCommand('selectAll') },
        { separator: true },
        { label: t('menu.edit.find'), shortcut: 'Ctrl+F', onClick: dispatchFind },
        { label: t('menu.edit.replace'), shortcut: 'Ctrl+H', onClick: dispatchReplace },
      ],
    },
    {
      label: '当前文件',
      children: [
        { label: '复制路径', onClick: copyPath, disabled: !activeAbsolutePath },
        { label: '使用默认应用打开', onClick: openWithDefault, disabled: !activeAbsolutePath },
        { label: '在资源管理器中显示', onClick: showInExplorer, disabled: !activeAbsolutePath },
      ],
    },
    { separator: true },
    {
      label: t('menu.view'),
      children: [
        { label: t('menu.view.wysiwyg'), checked: editorMode === 'wysiwyg', onClick: () => setEditorMode('wysiwyg') },
        { label: t('menu.view.sourceMode'), shortcut: 'Ctrl+/', checked: editorMode === 'source', onClick: () => setEditorMode('source') },
        { label: t('menu.view.readingMode'), checked: editorMode === 'reading', onClick: () => setEditorMode('reading') },
        { separator: true },
        { label: t('menu.view.focusMode'), shortcut: 'F11', checked: focusMode, onClick: toggleFocusMode },
        { label: t('menu.view.typewriterMode'), checked: typewriterMode, onClick: toggleTypewriterMode },
        { separator: true },
        { label: t('menu.view.zoomIn'), shortcut: 'Ctrl+=', onClick: zoomIn },
        { label: t('menu.view.zoomOut'), shortcut: 'Ctrl+-', onClick: zoomOut },
        { label: t('menu.view.zoomReset'), shortcut: 'Ctrl+0', onClick: zoomReset },
      ],
    },
    {
      label: t('menu.theme'),
      children: [
        { label: t('menu.theme.light'), checked: theme === 'light', onClick: () => setTheme('light') },
        { label: t('menu.theme.dark'), checked: theme === 'dark', onClick: () => setTheme('dark') },
        { label: t('menu.theme.morandi'), checked: theme === 'morandi', onClick: () => setTheme('morandi') },
        { label: t('menu.theme.eyeCare'), checked: theme === 'eye-care', onClick: () => setTheme('eye-care') },
        { separator: true },
        { label: t('menu.theme.monokai'), checked: theme === 'monokai', onClick: () => setTheme('monokai') },
        { label: t('menu.theme.dracula'), checked: theme === 'dracula', onClick: () => setTheme('dracula') },
        { label: t('menu.theme.solarizedLight'), checked: theme === 'solarized-light', onClick: () => setTheme('solarized-light') },
        { label: t('menu.theme.oneDark'), checked: theme === 'one-dark', onClick: () => setTheme('one-dark') },
        { separator: true },
        { label: t('menu.theme.system'), checked: theme === 'system', onClick: () => setTheme('system') },
      ],
    },
    { separator: true },
    {
      label: t('menu.help'),
      children: [
        { label: t('menu.help.syntax'), onClick: () => setHelpModal('syntax') },
        { label: t('menu.help.shortcuts'), onClick: () => setHelpModal('shortcuts') },
        { label: t('menu.help.changelog'), onClick: () => setHelpModal('changelog') },
        { label: t('menu.help.about'), onClick: () => setHelpModal('about') },
        { separator: true },
        { label: t('menu.help.language'), onClick: () => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN') },
      ],
    },
    { label: t('menu.file.preferences'), shortcut: 'Ctrl+,', onClick: () => setSettingsOpen(true) },
  ]

  const closeFile = () => setActiveFile('', '', [], null)

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        {activeFile && (
          <div className={styles.tab}>
            <span className={styles.tabName}>{activeFile}</span>
            <button
              className={styles.tabClose}
              onClick={closeFile}
              title="关闭"
              aria-label="close"
            >×</button>
          </div>
        )}
        <button
          className={styles.btn}
          onClick={() => newFile()}
          title={t('menu.file.new')}
          aria-label={t('menu.file.new')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </button>
      </div>
      <div className={styles.right}>
        <button
          ref={kebabBtnRef}
          className={styles.btn}
          onClick={openKebab}
          title="更多"
        >
          ⋮
        </button>
      </div>
      {kebabOpen && kebabAnchor && (
        <PopoverMenu items={kebabItems} x={kebabAnchor.x} y={kebabAnchor.y} onClose={() => setKebabOpen(false)} />
      )}
    </div>
  )
}
