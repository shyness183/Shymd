import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import {
  cmdHeading, cmdParagraph, cmdQuote, cmdOrderedList, cmdUnorderedList,
  cmdTaskList, cmdCodeBlock, cmdMathBlock, cmdHorizontalRule,
  cmdBold, cmdItalic, cmdUnderline, cmdStrikethrough, cmdInlineCode,
  cmdInlineMath, cmdHighlight, cmdHyperlink, cmdImage,
  cmdFind, cmdReplace, getEditorView,
} from '../../lib/editorCommands'
import {
  htmlBold, htmlItalic, htmlUnderline, htmlStrikethrough, htmlInlineCode,
  htmlHighlight, htmlHyperlink, htmlHeading, htmlParagraph,
  htmlQuote, htmlUnorderedList, htmlOrderedList, htmlTaskList,
  htmlCodeBlock, htmlImage, htmlInlineMath, htmlMathBlock,
  htmlHorizontalRule, getCERoot, saveSelection,
} from '../../lib/htmlEditorCommands'
import { exportHTML, saveMarkdown, saveMarkdownAs, openMarkdown, openFolder, newFile } from '../../lib/fileActions'
import { MenuDropdown } from './MenuDropdown'
import type { MenuItem } from './MenuDropdown'
import styles from './MenuBar.module.css'

export function MenuBar() {
  const { t, locale, setLocale } = useLocale()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const editorMode = useAppStore((s) => s.editorMode)
  const setEditorMode = useAppStore((s) => s.setEditorMode)
  const focusMode = useAppStore((s) => s.focusMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const typewriterMode = useAppStore((s) => s.typewriterMode)
  const toggleTypewriterMode = useAppStore((s) => s.toggleTypewriterMode)
  const zoomIn = useAppStore((s) => s.zoomIn)
  const zoomOut = useAppStore((s) => s.zoomOut)
  const zoomReset = useAppStore((s) => s.zoomReset)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const setHelpModal = useAppStore((s) => s.setHelpModal)
  const recentFiles = useAppStore((s) => s.recentFiles)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const removeRecentFile = useAppStore((s) => s.removeRecentFile)
  const clearRecentFiles = useAppStore((s) => s.clearRecentFiles)

  // Mode-aware dispatch: pick html* or cmd* depending on active editor
  const isWysiwyg = () => editorMode === 'wysiwyg' && !!getCERoot()
  const isSource = () => editorMode === 'source' && !!getEditorView()
  const dispatch = (srcFn: () => void, htmlFn: () => void) => () => {
    if (isWysiwyg()) htmlFn()
    else if (isSource()) srcFn()
  }
  const dispatchHeading = (level: number) => () => {
    if (isWysiwyg()) htmlHeading(level)
    else if (isSource()) cmdHeading(level)
  }

  const openRecentFile = (name: string) => {
    // Find file content in the tree
    const findContent = (nodes: typeof useAppStore.getState extends () => infer S ? S extends { files: infer F } ? F : never : never, target: string): string | undefined => {
      for (const n of nodes as any[]) {
        if (n.type === 'file' && n.name === target) return n.content ?? ''
        if (n.type === 'folder' && n.children) {
          const found = findContent(n.children, target)
          if (found !== undefined) return found
        }
      }
      return undefined
    }
    const content = findContent(useAppStore.getState().files, name)
    if (content !== undefined) setActiveFile(name, content)
  }

  const recentItems: MenuItem[] = recentFiles.length > 0
    ? [
        ...recentFiles.map((name) => ({
          label: name,
          onClick: () => openRecentFile(name),
          onRemove: () => removeRecentFile(name),
        })),
        { separator: true, label: '' } as MenuItem,
        { label: t('menu.file.clearRecent'), onClick: clearRecentFiles },
      ]
    : [{ label: t('menu.file.recent') + ' (∅)', onClick: () => {} }]

  const fileMenu: MenuItem[] = [
    { label: t('menu.file.new'), shortcut: 'Ctrl+N', onClick: newFile },
    { label: t('menu.file.open'), shortcut: 'Ctrl+O', onClick: openMarkdown },
    { label: t('menu.file.openFolder'), shortcut: 'Ctrl+Shift+O', onClick: openFolder },
    { separator: true, label: '' },
    { label: t('menu.file.save'), shortcut: 'Ctrl+S', onClick: saveMarkdown },
    { label: t('menu.file.saveAs'), shortcut: 'Ctrl+Shift+S', onClick: saveMarkdownAs },
    { separator: true, label: '' },
    { label: t('menu.file.exportHtml'), onClick: exportHTML },
    { separator: true, label: '' },
    { label: t('menu.file.recent'), onClick: () => {} },
    ...recentItems,
    { separator: true, label: '' },
    { label: t('menu.file.preferences'), shortcut: 'Ctrl+,', onClick: () => setSettingsOpen(true) },
  ]

  const editMenu: MenuItem[] = [
    { label: t('menu.edit.undo'), shortcut: 'Ctrl+Z', onClick: () => document.execCommand('undo') },
    { label: t('menu.edit.redo'), shortcut: 'Ctrl+Shift+Z', onClick: () => document.execCommand('redo') },
    { separator: true, label: '' },
    { label: t('menu.edit.cut'), shortcut: 'Ctrl+X', onClick: () => document.execCommand('cut') },
    { label: t('menu.edit.copy'), shortcut: 'Ctrl+C', onClick: () => document.execCommand('copy') },
    { label: t('menu.edit.paste'), shortcut: 'Ctrl+V', onClick: () => document.execCommand('paste') },
    { label: t('menu.edit.selectAll'), shortcut: 'Ctrl+A', onClick: () => document.execCommand('selectAll') },
    { separator: true, label: '' },
    {
      label: t('menu.edit.find'),
      shortcut: 'Ctrl+F',
      onClick: () => {
        if (editorMode === 'source') cmdFind()
        else useAppStore.getState().setFindOpen(true, 'find')
      },
    },
    {
      label: t('menu.edit.replace'),
      shortcut: 'Ctrl+H',
      onClick: () => {
        if (editorMode === 'source') cmdReplace()
        else useAppStore.getState().setFindOpen(true, 'replace')
      },
    },
  ]

  const paragraphMenu: MenuItem[] = [
    { label: t('menu.paragraph.h1'), shortcut: 'Ctrl+1', onClick: dispatchHeading(1) },
    { label: t('menu.paragraph.h2'), shortcut: 'Ctrl+2', onClick: dispatchHeading(2) },
    { label: t('menu.paragraph.h3'), shortcut: 'Ctrl+3', onClick: dispatchHeading(3) },
    { label: t('menu.paragraph.h4'), shortcut: 'Ctrl+4', onClick: dispatchHeading(4) },
    { label: t('menu.paragraph.h5'), shortcut: 'Ctrl+5', onClick: dispatchHeading(5) },
    { label: t('menu.paragraph.h6'), shortcut: 'Ctrl+6', onClick: dispatchHeading(6) },
    { label: t('menu.paragraph.paragraph'), shortcut: 'Ctrl+0', onClick: dispatch(cmdParagraph, htmlParagraph) },
    { separator: true, label: '' },
    { label: t('menu.paragraph.quote'), shortcut: 'Ctrl+Shift+Q', onClick: dispatch(cmdQuote, htmlQuote) },
    { label: t('menu.paragraph.orderedList'), shortcut: 'Ctrl+Shift+[', onClick: dispatch(cmdOrderedList, htmlOrderedList) },
    { label: t('menu.paragraph.unorderedList'), shortcut: 'Ctrl+Shift+]', onClick: dispatch(cmdUnorderedList, htmlUnorderedList) },
    { label: t('menu.paragraph.taskList'), onClick: dispatch(cmdTaskList, htmlTaskList) },
    { separator: true, label: '' },
    { label: t('menu.paragraph.codeBlock'), shortcut: 'Ctrl+Shift+K', onClick: dispatch(cmdCodeBlock, htmlCodeBlock) },
    { label: t('menu.paragraph.mathBlock'), shortcut: 'Ctrl+Shift+M', onClick: dispatch(cmdMathBlock, htmlMathBlock) },
    { label: t('menu.paragraph.horizontalRule'), onClick: dispatch(cmdHorizontalRule, htmlHorizontalRule) },
    {
      label: t('menu.paragraph.table'),
      shortcut: 'Ctrl+T',
      onClick: () => {
        if (isWysiwyg()) saveSelection()
        useAppStore.getState().setTablePickerOpen(true)
      },
    },
  ]

  const formatMenu: MenuItem[] = [
    { label: t('menu.format.bold'), shortcut: 'Ctrl+B', onClick: dispatch(cmdBold, htmlBold) },
    { label: t('menu.format.italic'), shortcut: 'Ctrl+I', onClick: dispatch(cmdItalic, htmlItalic) },
    { label: t('menu.format.underline'), shortcut: 'Ctrl+U', onClick: dispatch(cmdUnderline, htmlUnderline) },
    { label: t('menu.format.strikethrough'), shortcut: 'Alt+Shift+5', onClick: dispatch(cmdStrikethrough, htmlStrikethrough) },
    { separator: true, label: '' },
    { label: t('menu.format.inlineCode'), shortcut: 'Ctrl+`', onClick: dispatch(cmdInlineCode, htmlInlineCode) },
    { label: t('menu.format.inlineMath'), shortcut: 'Ctrl+Shift+E', onClick: dispatch(cmdInlineMath, htmlInlineMath) },
    { label: t('menu.format.highlight'), onClick: dispatch(cmdHighlight, () => htmlHighlight()) },
    { separator: true, label: '' },
    { label: t('menu.format.hyperlink'), shortcut: 'Ctrl+K', onClick: dispatch(cmdHyperlink, htmlHyperlink) },
    { label: t('menu.format.image'), shortcut: 'Ctrl+Shift+I', onClick: dispatch(cmdImage, htmlImage) },
  ]

  const viewMenu: MenuItem[] = [
    { label: t('menu.view.sidebar'), shortcut: 'Ctrl+\\', checked: sidebarVisible, onClick: toggleSidebar },
    { separator: true, label: '' },
    { label: t('menu.view.wysiwyg'), checked: editorMode === 'wysiwyg', onClick: () => setEditorMode('wysiwyg') },
    { label: t('menu.view.sourceMode'), shortcut: 'Ctrl+/', checked: editorMode === 'source', onClick: () => setEditorMode('source') },
    { label: t('menu.view.readingMode'), checked: editorMode === 'reading', onClick: () => setEditorMode('reading') },
    { separator: true, label: '' },
    { label: t('menu.view.focusMode'), shortcut: 'F11', checked: focusMode, onClick: toggleFocusMode },
    { label: t('menu.view.typewriterMode'), checked: typewriterMode, onClick: toggleTypewriterMode },
    { separator: true, label: '' },
    { label: t('menu.view.zoomIn'), shortcut: 'Ctrl+=', onClick: zoomIn },
    { label: t('menu.view.zoomOut'), shortcut: 'Ctrl+-', onClick: zoomOut },
    { label: t('menu.view.zoomReset'), shortcut: 'Ctrl+0', onClick: zoomReset },
  ]

  const themeMenu: MenuItem[] = [
    { label: t('menu.theme.light'), checked: theme === 'light', onClick: () => setTheme('light') },
    { label: t('menu.theme.dark'), checked: theme === 'dark', onClick: () => setTheme('dark') },
    { label: t('menu.theme.morandi'), checked: theme === 'morandi', onClick: () => setTheme('morandi') },
    { label: t('menu.theme.eyeCare'), checked: theme === 'eye-care', onClick: () => setTheme('eye-care') },
    { separator: true, label: '' },
    { label: t('menu.theme.system'), checked: theme === 'system', onClick: () => setTheme('system') },
  ]

  const helpMenu: MenuItem[] = [
    { label: t('menu.help.syntax'), onClick: () => setHelpModal('syntax') },
    { label: t('menu.help.shortcuts'), onClick: () => setHelpModal('shortcuts') },
    { separator: true, label: '' },
    { label: t('menu.help.changelog'), onClick: () => setHelpModal('changelog') },
    { separator: true, label: '' },
    { label: t('menu.help.about'), onClick: () => setHelpModal('about') },
    { separator: true, label: '' },
    {
      label: t('menu.help.language'),
      onClick: () => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN'),
    },
  ]

  return (
    <div className={styles.menubar}>
      <button
        className={`${styles.sidebarToggle}${sidebarVisible ? ' ' + styles.sidebarToggleActive : ''}`}
        onClick={toggleSidebar}
        title={sidebarVisible ? t('menu.view.sidebar') + ' (Ctrl+\\)' : t('menu.view.sidebar') + ' (Ctrl+\\)'}
      >
        <span className={styles.shutterIcon}>
          <span className={styles.shutterPane} />
          <span className={styles.shutterPane} />
        </span>
      </button>
      <div className={styles.menus}>
        <MenuDropdown label={t('menu.file')} items={fileMenu} />
        <MenuDropdown label={t('menu.edit')} items={editMenu} />
        <MenuDropdown label={t('menu.paragraph')} items={paragraphMenu} />
        <MenuDropdown label={t('menu.format')} items={formatMenu} />
        <MenuDropdown label={t('menu.view')} items={viewMenu} />
        <MenuDropdown label={t('menu.theme')} items={themeMenu} />
        <MenuDropdown label={t('menu.help')} items={helpMenu} />
      </div>
    </div>
  )
}
