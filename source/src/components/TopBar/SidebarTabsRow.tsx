import { SidebarTabs } from '../Sidebar/SidebarTabs'
import styles from './SidebarTabsRow.module.css'

/**
 * Row 2, column 1 — sits in the sidebar's column on the same horizontal
 * line as the editor's row-2 toolbar. Hosts the 大纲/文件 tab strip
 * (which used to live INSIDE <Sidebar> but the user wanted it aligned
 * with the editor's tab+kebab row).
 */
export function SidebarTabsRow() {
  return (
    <div className={styles.row}>
      <SidebarTabs />
    </div>
  )
}
