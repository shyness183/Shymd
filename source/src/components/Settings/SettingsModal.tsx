import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { isTauri, pickFolder } from '../../lib/filesystem'
import { Modal } from '../Modal/Modal'
import styles from './SettingsModal.module.css'
import type { Theme } from '../../types'

type TabKey =
  | 'general'
  | 'editor'
  | 'markdown'
  | 'spelling'
  | 'theme'
  | 'image'
  | 'keybinding'

interface TabDef {
  key: TabKey
  labelZh: string
  labelEn: string
  icon: string
}

const TABS: TabDef[] = [
  { key: 'general',    labelZh: '通用',       labelEn: 'General',      icon: '⚙' },
  { key: 'editor',     labelZh: '编辑器',     labelEn: 'Editor',       icon: '✎' },
  { key: 'markdown',   labelZh: 'Markdown',   labelEn: 'Markdown',     icon: 'M↓' },
  { key: 'spelling',   labelZh: '拼写检查',   labelEn: 'Spelling',     icon: '✓' },
  { key: 'theme',      labelZh: '主题',       labelEn: 'Theme',        icon: '◐' },
  { key: 'image',      labelZh: '图片',       labelEn: 'Image',        icon: '🖼' },
  { key: 'keybinding', labelZh: '快捷键',     labelEn: 'Key Binding',  icon: '⌘' },
]

export function SettingsModal() {
  const { t, locale, setLocale } = useLocale()
  const open = useAppStore((s) => s.settingsOpen)
  const setOpen = useAppStore((s) => s.setSettingsOpen)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  const showBrowse = isTauri()

  const browsePath = async (
    key: 'fileStoragePath' | 'downloadPath' | 'imageStoragePath' | 'cachePath',
  ) => {
    const dir = await pickFolder()
    if (dir) setSettings({ [key]: dir })
  }

  if (!open) return null

  const label = (z: string, e: string) => (locale === 'zh-CN' ? z : e)

  return (
    <Modal title={t('settings.title')} onClose={() => setOpen(false)} width={760}>
      <div className={styles.layout}>
        {/* ── Tab rail ──────────────────────────────────────────── */}
        <aside className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>
                {label(tab.labelZh, tab.labelEn)}
              </span>
            </button>
          ))}
        </aside>

        {/* ── Content pane ─────────────────────────────────────── */}
        <section className={styles.pane}>
          {/* === General === */}
          {activeTab === 'general' && (
            <>
              <h3 className={styles.sectionTitle}>{label('语言', 'Language')}</h3>
              <div className={styles.row}>
                <label className={styles.label}>{t('settings.language')}</label>
                <select
                  className={styles.select}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'zh-CN' | 'en-US')}
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>

              <h3 className={styles.sectionTitle}>{label('路径', 'Paths')}</h3>
              <div className={styles.rowStack}>
                <label className={styles.label}>{t('settings.fileStoragePath')}</label>
                <div className={styles.pathRow}>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Documents/Shymd"
                    value={settings.fileStoragePath}
                    onChange={(e) => setSettings({ fileStoragePath: e.target.value })}
                  />
                  {showBrowse && (
                    <button className={styles.browseBtn} onClick={() => browsePath('fileStoragePath')}>
                      {t('settings.browse')}
                    </button>
                  )}
                </div>
                <p className={styles.hint}>{t('settings.fileStoragePathHint')}</p>
              </div>

              <div className={styles.rowStack}>
                <label className={styles.label}>{t('settings.downloadPath')}</label>
                <div className={styles.pathRow}>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Downloads"
                    value={settings.downloadPath}
                    onChange={(e) => setSettings({ downloadPath: e.target.value })}
                  />
                  {showBrowse && (
                    <button className={styles.browseBtn} onClick={() => browsePath('downloadPath')}>
                      {t('settings.browse')}
                    </button>
                  )}
                </div>
                <p className={styles.hint}>{t('settings.downloadPathHint')}</p>
              </div>
            </>
          )}

          {/* === Editor === */}
          {activeTab === 'editor' && (
            <>
              <h3 className={styles.sectionTitle}>{label('自动保存', 'Auto Save')}</h3>
              <div className={styles.row}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => setSettings({ autoSave: e.target.checked })}
                  />
                  <span style={{ marginLeft: 8 }}>{t('settings.autoSave')}</span>
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>{t('settings.autoSaveDelay')}</label>
                <input
                  className={styles.inputSmall}
                  type="number"
                  min={200}
                  max={10000}
                  step={100}
                  value={settings.autoSaveDelay}
                  onChange={(e) => setSettings({ autoSaveDelay: Number(e.target.value) })}
                />
                <span className={styles.unit}>ms</span>
              </div>
              <p className={styles.hint}>
                {label(
                  '输入停止后自动保存。改小可更及时,改大可减少磁盘写入。',
                  'Auto-save after this idle time. Lower = more responsive, higher = fewer disk writes.',
                )}
              </p>
            </>
          )}

          {/* === Markdown === */}
          {activeTab === 'markdown' && (
            <>
              <h3 className={styles.sectionTitle}>{label('扩展语法', 'Extensions')}</h3>
              <ul className={styles.featureList}>
                <li>✓ GFM Tables, Strikethrough, Task Lists</li>
                <li>✓ KaTeX Math ($...$, $$...$$)</li>
                <li>✓ Mermaid Diagrams (```mermaid)</li>
                <li>✓ Footnotes ([^1])</li>
                <li>✓ Highlight (==text==)</li>
                <li>✓ YAML Front Matter</li>
                <li>✓ TOC placeholder ([TOC])</li>
                <li>✓ Syntax highlighting (highlight.js)</li>
              </ul>
              <p className={styles.hint}>
                {label(
                  '目前所有扩展均默认启用。后续版本会在此提供精细开关。',
                  'All extensions are currently enabled by default. Per-extension toggles will arrive in a future release.',
                )}
              </p>
            </>
          )}

          {/* === Spelling === */}
          {activeTab === 'spelling' && (
            <>
              <h3 className={styles.sectionTitle}>{label('拼写检查', 'Spell Check')}</h3>
              <div className={styles.row}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.spellcheck}
                    onChange={(e) => setSettings({ spellcheck: e.target.checked })}
                  />
                  <span style={{ marginLeft: 8 }}>
                    {label('开启浏览器拼写检查', 'Enable browser spell check')}
                  </span>
                </label>
              </div>
              <p className={styles.hint}>
                {label(
                  '由系统词典提供。切换后需重新进入编辑器以生效。',
                  'Backed by the system dictionary. Toggle takes effect after you click back into the editor.',
                )}
              </p>

              <div className={styles.row} style={{ marginTop: 16 }}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.floatingToolbarEnabled}
                    onChange={(e) => setSettings({ floatingToolbarEnabled: e.target.checked })}
                  />
                  <span style={{ marginLeft: 8 }}>
                    {label('开启浮动工具栏', 'Enable floating toolbar')}
                  </span>
                </label>
              </div>
              <p className={styles.hint}>
                {label(
                  '关闭后通过右键菜单 / 快捷键格式化。默认关闭。',
                  'When off, format via the right-click menu or shortcuts. Off by default.',
                )}
              </p>
            </>
          )}

          {/* === Theme === */}
          {activeTab === 'theme' && (
            <>
              <h3 className={styles.sectionTitle}>{label('外观', 'Appearance')}</h3>
              <div className={styles.row}>
                <label className={styles.label}>{t('settings.theme')}</label>
                <select
                  className={styles.select}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                >
                  <option value="light">{t('menu.theme.light')}</option>
                  <option value="dark">{t('menu.theme.dark')}</option>
                  <option value="morandi">{t('menu.theme.morandi')}</option>
                  <option value="eye-care">{t('menu.theme.eyeCare')}</option>
                  <option value="monokai">{t('menu.theme.monokai')}</option>
                  <option value="dracula">{t('menu.theme.dracula')}</option>
                  <option value="solarized-light">{t('menu.theme.solarizedLight')}</option>
                  <option value="one-dark">{t('menu.theme.oneDark')}</option>
                  <option value="system">{t('menu.theme.system')}</option>
                </select>
              </div>
              <p className={styles.hint}>
                {label(
                  '系统模式会跟随操作系统的深浅色切换。',
                  '"System" follows your OS light/dark preference.',
                )}
              </p>
            </>
          )}

          {/* === Image === */}
          {activeTab === 'image' && (
            <>
              <h3 className={styles.sectionTitle}>{label('图片存储', 'Image Storage')}</h3>
              <div className={styles.rowStack}>
                <label className={styles.label}>
                  {label('图片保存目录', 'Image storage folder')}
                </label>
                <div className={styles.pathRow}>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder={label('留空使用原图位置', 'Blank = reference picked file directly')}
                    value={settings.imageStoragePath}
                    onChange={(e) => setSettings({ imageStoragePath: e.target.value })}
                  />
                  {showBrowse && (
                    <button className={styles.browseBtn} onClick={() => browsePath('imageStoragePath')}>
                      {t('settings.browse')}
                    </button>
                  )}
                </div>
                <p className={styles.hint}>
                  {label(
                    '设置后,插入图片时会复制到该目录,笔记移动也不会断链。',
                    'If set, inserted images are copied here so they keep working when you move notes.',
                  )}
                </p>
              </div>

              <h3 className={styles.sectionTitle}>{label('缓存目录', 'Cache')}</h3>
              <div className={styles.rowStack}>
                <label className={styles.label}>
                  {label('缓存目录', 'Cache folder')}
                </label>
                <div className={styles.pathRow}>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder={label('暂未使用', 'Reserved for future features')}
                    value={settings.cachePath}
                    onChange={(e) => setSettings({ cachePath: e.target.value })}
                  />
                  {showBrowse && (
                    <button className={styles.browseBtn} onClick={() => browsePath('cachePath')}>
                      {t('settings.browse')}
                    </button>
                  )}
                </div>
                <p className={styles.hint}>
                  {label(
                    '预留给未来的插件 / 缩略图缓存使用。',
                    'Reserved for plugin & thumbnail cache in upcoming releases.',
                  )}
                </p>
              </div>
            </>
          )}

          {/* === Key Binding === */}
          {activeTab === 'keybinding' && (
            <>
              <h3 className={styles.sectionTitle}>{label('常用快捷键', 'Common Shortcuts')}</h3>
              <KeyBindingList />
              <p className={styles.hint}>
                {label(
                  '快捷键自定义将在未来版本开放。',
                  'Customisable bindings are planned for a future release.',
                )}
              </p>
            </>
          )}
        </section>
      </div>

      <div className={styles.footer}>
        <button className={styles.btn} onClick={() => setOpen(false)}>
          {t('settings.close')}
        </button>
      </div>
    </Modal>
  )
}

// ─── Key binding list (read-only) ─────────────────────────────────
const BINDINGS: { combo: string; labelZh: string; labelEn: string }[] = [
  { combo: 'Ctrl+S',        labelZh: '保存',         labelEn: 'Save' },
  { combo: 'Ctrl+O',        labelZh: '打开文件',     labelEn: 'Open file' },
  { combo: 'Ctrl+N',        labelZh: '新建文件',     labelEn: 'New file' },
  { combo: 'Ctrl+Shift+S',  labelZh: '另存为',       labelEn: 'Save as' },
  { combo: 'Ctrl+F',        labelZh: '查找',         labelEn: 'Find' },
  { combo: 'Ctrl+H',        labelZh: '替换',         labelEn: 'Replace' },
  { combo: 'Ctrl+B',        labelZh: '加粗',         labelEn: 'Bold' },
  { combo: 'Ctrl+I',        labelZh: '斜体',         labelEn: 'Italic' },
  { combo: 'Ctrl+U',        labelZh: '下划线',       labelEn: 'Underline' },
  { combo: 'Ctrl+Shift+E',  labelZh: '行内数学',     labelEn: 'Inline math' },
  { combo: 'Ctrl+Shift+M',  labelZh: '数学块',       labelEn: 'Math block' },
  { combo: 'Ctrl+K',        labelZh: '超链接',       labelEn: 'Hyperlink' },
  { combo: 'Ctrl+,',        labelZh: '设置',         labelEn: 'Settings' },
  { combo: 'Ctrl+/',        labelZh: '切换编辑模式', labelEn: 'Cycle edit mode' },
  { combo: 'Ctrl+Shift+P',  labelZh: '聚焦模式',     labelEn: 'Focus mode' },
  { combo: '/',             labelZh: '插入块命令',   labelEn: 'Slash commands' },
]

function KeyBindingList() {
  const { locale } = useLocale()
  return (
    <div className={styles.kbList}>
      {BINDINGS.map((b) => (
        <div key={b.combo} className={styles.kbRow}>
          <kbd className={styles.kbKey}>{b.combo}</kbd>
          <span className={styles.kbLabel}>
            {locale === 'zh-CN' ? b.labelZh : b.labelEn}
          </span>
        </div>
      ))}
    </div>
  )
}
