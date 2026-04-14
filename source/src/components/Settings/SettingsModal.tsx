import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { isTauri, pickFolder } from '../../lib/filesystem'
import { Modal } from '../Modal/Modal'
import styles from './SettingsModal.module.css'
import type { Theme } from '../../types'

export function SettingsModal() {
  const { t, locale, setLocale } = useLocale()
  const open = useAppStore((s) => s.settingsOpen)
  const setOpen = useAppStore((s) => s.setSettingsOpen)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const showBrowse = isTauri()

  const browsePath = async (key: 'fileStoragePath' | 'downloadPath' | 'cachePath') => {
    const dir = await pickFolder()
    if (dir) setSettings({ [key]: dir })
  }

  if (!open) return null

  return (
    <Modal title={t('settings.title')} onClose={() => setOpen(false)} width={600}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('settings.appearance')}</h3>

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
            <option value="system">{t('menu.theme.system')}</option>
          </select>
        </div>

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
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('settings.paths')}</h3>

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

        <div className={styles.rowStack}>
          <label className={styles.label}>{t('settings.cachePath')}</label>
          <div className={styles.pathRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="AppData/Local/Shymd/cache"
              value={settings.cachePath}
              onChange={(e) => setSettings({ cachePath: e.target.value })}
            />
            {showBrowse && (
              <button className={styles.browseBtn} onClick={() => browsePath('cachePath')}>
                {t('settings.browse')}
              </button>
            )}
          </div>
          <p className={styles.hint}>{t('settings.cachePathHint')}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('settings.editor')}</h3>

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
      </div>

      <div className={styles.footer}>
        <button className={styles.btn} onClick={() => setOpen(false)}>
          {t('settings.close')}
        </button>
      </div>
    </Modal>
  )
}
