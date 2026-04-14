import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import styles from './SidebarTabs.module.css'

export function SidebarTabs() {
  const { t } = useLocale()
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <div className={styles.tabs}>
      <button
        className={`${styles.tab} ${activeTab === 'files' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('files')}
      >
        {t('sidebar.files')}
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'outline' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('outline')}
      >
        {t('sidebar.outline')}
      </button>
    </div>
  )
}
