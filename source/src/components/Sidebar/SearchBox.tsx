import { useLocale } from '../../hooks/useLocale'
import styles from './SearchBox.module.css'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBox({ value, onChange }: SearchBoxProps) {
  const { t } = useLocale()

  return (
    <div className={styles.searchBox}>
      <div className={styles.inputWrapper}>
        <input
          className={styles.input}
          type="text"
          value={value}
          placeholder={t('sidebar.search')}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onChange('')
          }}
        />
        <button
          className={styles.searchBtn}
          onClick={() => {/* search is instant via filter */}}
          title={t('sidebar.search')}
        >
          🔍
        </button>
        {value && (
          <button
            className={styles.clearBtn}
            onClick={() => onChange('')}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
