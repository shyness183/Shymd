import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { Modal } from '../Modal/Modal'
import styles from './HelpModals.module.css'

interface ShortcutRow {
  label: string
  keys: string
}

function buildShortcuts(t: (k: string) => string): { group: string; rows: ShortcutRow[] }[] {
  return [
    {
      group: t('menu.file'),
      rows: [
        { label: t('menu.file.new'), keys: 'Ctrl+N' },
        { label: t('menu.file.open'), keys: 'Ctrl+O' },
        { label: t('menu.file.save'), keys: 'Ctrl+S' },
        { label: t('menu.file.preferences'), keys: 'Ctrl+,' },
      ],
    },
    {
      group: t('menu.edit'),
      rows: [
        { label: t('menu.edit.undo'), keys: 'Ctrl+Z' },
        { label: t('menu.edit.redo'), keys: 'Ctrl+Shift+Z' },
        { label: t('menu.edit.find'), keys: 'Ctrl+F' },
        { label: t('menu.edit.replace'), keys: 'Ctrl+H' },
      ],
    },
    {
      group: t('menu.paragraph'),
      rows: [
        { label: t('menu.paragraph.h1') + ' ~ ' + t('menu.paragraph.h6'), keys: 'Ctrl+1 ~ Ctrl+6' },
        { label: t('menu.paragraph.paragraph'), keys: 'Ctrl+0' },
        { label: t('menu.paragraph.quote'), keys: 'Ctrl+Shift+Q' },
        { label: t('menu.paragraph.codeBlock'), keys: 'Ctrl+Shift+K' },
        { label: t('menu.paragraph.mathBlock'), keys: 'Ctrl+Shift+M' },
        { label: t('menu.paragraph.table'), keys: 'Ctrl+T' },
      ],
    },
    {
      group: t('menu.format'),
      rows: [
        { label: t('menu.format.bold'), keys: 'Ctrl+B' },
        { label: t('menu.format.italic'), keys: 'Ctrl+I' },
        { label: t('menu.format.underline'), keys: 'Ctrl+U' },
        { label: t('menu.format.inlineCode'), keys: 'Ctrl+`' },
        { label: t('menu.format.hyperlink'), keys: 'Ctrl+K' },
      ],
    },
    {
      group: t('menu.view'),
      rows: [
        { label: t('menu.view.sidebar'), keys: 'Ctrl+\\' },
        { label: t('menu.view.sourceMode'), keys: 'Ctrl+/' },
        { label: t('menu.view.focusMode'), keys: 'F11' },
        { label: t('menu.view.zoomIn'), keys: 'Ctrl+=' },
        { label: t('menu.view.zoomOut'), keys: 'Ctrl+-' },
        { label: t('menu.view.zoomReset'), keys: 'Ctrl+0' },
      ],
    },
  ]
}

const syntaxRows = [
  { name: '标题 Heading', syntax: '# / ## / ### …' },
  { name: '加粗 Bold', syntax: '**text**' },
  { name: '斜体 Italic', syntax: '*text*' },
  { name: '删除线 Strikethrough', syntax: '~~text~~' },
  { name: '高亮 Highlight', syntax: '==text==' },
  { name: '行内代码 Inline code', syntax: '`code`' },
  { name: '代码块 Code block', syntax: '```lang\n...\n```' },
  { name: '链接 Link', syntax: '[text](url)' },
  { name: '图片 Image', syntax: '![alt](src)' },
  { name: '引用 Blockquote', syntax: '> text' },
  { name: '无序列表 Bullet list', syntax: '- item' },
  { name: '有序列表 Ordered list', syntax: '1. item' },
  { name: '任务列表 Task list', syntax: '- [ ] todo' },
  { name: '水平线 HR', syntax: '---' },
  { name: '行内公式 Inline math', syntax: '$E=mc^2$' },
  { name: '块级公式 Block math', syntax: '$$\\int_a^b$$' },
  { name: '表格 Table', syntax: '| h1 | h2 |\n|----|----|' },
  { name: '脚注 Footnote', syntax: 'text[^1]\n\n[^1]: note' },
]

export function HelpModals() {
  const { t } = useLocale()
  const helpModal = useAppStore((s) => s.helpModal)
  const setHelpModal = useAppStore((s) => s.setHelpModal)
  const close = () => setHelpModal(null)

  if (!helpModal) return null

  if (helpModal === 'shortcuts') {
    const groups = buildShortcuts(t)
    return (
      <Modal title={t('menu.help.shortcuts')} onClose={close} width={560}>
        {groups.map((g) => (
          <div key={g.group} className={styles.group}>
            <h4 className={styles.groupTitle}>{g.group}</h4>
            <table className={styles.table}>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.label}>
                    <td className={styles.cellLabel}>{r.label}</td>
                    <td className={styles.cellKeys}>
                      <kbd className={styles.kbd}>{r.keys}</kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Modal>
    )
  }

  if (helpModal === 'syntax') {
    return (
      <Modal title={t('menu.help.syntax')} onClose={close} width={600}>
        <table className={styles.table}>
          <tbody>
            {syntaxRows.map((r) => (
              <tr key={r.name}>
                <td className={styles.cellLabel}>{r.name}</td>
                <td className={styles.cellKeys}>
                  <code className={styles.codeInline}>{r.syntax}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    )
  }

  if (helpModal === 'about') {
    return (
      <Modal title={t('menu.help.about')} onClose={close} width={420}>
        <div className={styles.about}>
          <div className={styles.logo}>Shymd</div>
          <div className={styles.version}>v0.2.0 (M2)</div>
          <p className={styles.desc}>{t('about.desc')}</p>
          <p className={styles.copy}>© 2026 Shymd Project</p>
        </div>
      </Modal>
    )
  }

  if (helpModal === 'changelog') {
    return (
      <Modal title={t('menu.help.changelog')} onClose={close} width={560}>
        <div className={styles.changelog}>
          <h4>v0.2.0 — M2 · 功能完善</h4>
          <ul>
            <li>三种编辑模式（编辑 / 源码 / 阅读）</li>
            <li>contentEditable 直接编辑 + 浮动格式工具栏</li>
            <li>完整菜单功能、快捷键</li>
            <li>扩展语法（GFM + 数学公式 + 高亮 + 脚注 + 任务列表）</li>
            <li>大纲跳转、文件树右键菜单</li>
            <li>偏好设置、4 种主题、聚焦模式、打字机模式、缩放</li>
          </ul>
          <h4>v0.1.0 — M1 · Web 原型</h4>
          <ul>
            <li>三区布局（菜单栏 + 侧边栏 + 编辑区）</li>
            <li>双主题切换</li>
            <li>i18n 双语支持</li>
          </ul>
        </div>
      </Modal>
    )
  }

  return null
}
