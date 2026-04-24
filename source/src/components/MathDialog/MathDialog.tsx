import { useEffect, useRef, useState, useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMathDialogStore, commitMathDialog } from '../../lib/mathDialog'
import styles from './MathDialog.module.css'

// A small cheatsheet surfaced in the empty-preview area so users unfamiliar
// with LaTeX have a starting point. Clicking an item inserts it into the
// editor at the current caret position.
const SNIPPETS: { label: string; tex: string }[] = [
  { label: 'x²',         tex: 'x^2' },
  { label: '分数',       tex: '\\frac{a}{b}' },
  { label: '根号',       tex: '\\sqrt{x}' },
  { label: '求和',       tex: '\\sum_{i=1}^{n} i' },
  { label: '积分',       tex: '\\int_{0}^{\\infty} f(x)\\,dx' },
  { label: '极限',       tex: '\\lim_{x \\to 0} \\frac{\\sin x}{x}' },
  { label: '矩阵',       tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: '向量',       tex: '\\vec{v}' },
  { label: '希腊字母',    tex: '\\alpha \\beta \\gamma \\delta' },
  { label: '方程组',      tex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}' },
]

export function MathDialog() {
  const { open, initialTex, initialDisplay } = useMathDialogStore()
  const [tex, setTex] = useState('')
  const [display, setDisplay] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync local input state whenever the dialog is (re)opened.
  useEffect(() => {
    if (!open) return
    setTex(initialTex)
    setDisplay(initialDisplay)
    setErr(null)
    // Focus + select so the user can immediately start typing / overwrite.
    const h = window.setTimeout(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      ta.select()
    }, 30)
    return () => window.clearTimeout(h)
  }, [open, initialTex, initialDisplay])

  // Live render — recompute only when tex or display mode changes.
  // Pure useMemo (no setState inside) to avoid React's "Cannot update a
  // component while rendering" warning; the error string is computed as
  // part of the memoised result and committed together with the HTML.
  const { previewHtml, previewErr } = useMemo(() => {
    if (!tex.trim()) return { previewHtml: '', previewErr: null as string | null }
    try {
      const html = katex.renderToString(tex, {
        throwOnError: true,
        displayMode: display,
      })
      return { previewHtml: html, previewErr: null as string | null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { previewHtml: '', previewErr: msg }
    }
  }, [tex, display])

  // Mirror the memoised error into local state so the legacy `err`
  // variable (used by the confirm-disable logic) stays in sync.
  useEffect(() => {
    setErr(previewErr)
  }, [previewErr])

  if (!open) return null

  const confirm = () => {
    const final = tex.trim()
    if (!final) { textareaRef.current?.focus(); return }
    if (err) return   // Disallow confirming an invalid formula.
    commitMathDialog({ tex: final, display })
  }

  const cancel = () => commitMathDialog(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd+Enter submits; plain Enter inside the textarea inserts a
    // newline (users write multi-line LaTeX for matrices, cases, etc.).
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirm() }
    if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }

  const insertSnippet = (snippet: string) => {
    const ta = textareaRef.current
    if (!ta) { setTex((v) => v + snippet); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = tex.slice(0, start)
    const after = tex.slice(end)
    const next = before + snippet + after
    setTex(next)
    // Re-focus and position caret after the inserted snippet.
    window.setTimeout(() => {
      ta.focus()
      const pos = start + snippet.length
      ta.setSelectionRange(pos, pos)
    }, 0)
  }

  return (
    <div className={styles.backdrop} onMouseDown={cancel}>
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>插入数学公式</div>
          <div className={styles.modeGroup}>
            <button
              type="button"
              className={`${styles.modeBtn} ${!display ? styles.modeBtnActive : ''}`}
              onClick={() => setDisplay(false)}
              title="行内公式 $...$"
            >
              行内
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${display ? styles.modeBtnActive : ''}`}
              onClick={() => setDisplay(true)}
              title="块级公式 $$...$$"
            >
              块级
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="E = mc^2"
          value={tex}
          onChange={(e) => setTex(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
        />

        <div className={styles.previewLabel}>预览</div>
        <div className={styles.preview}>
          {err ? (
            <div className={styles.error}>{err}</div>
          ) : previewHtml ? (
            <div
              className={display ? styles.previewDisplay : styles.previewInline}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div className={styles.placeholder}>
              开始输入 LaTeX …
            </div>
          )}
        </div>

        <div className={styles.snippetsLabel}>常用片段</div>
        <div className={styles.snippets}>
          {SNIPPETS.map((s) => (
            <button
              key={s.label}
              type="button"
              className={styles.snippet}
              title={s.tex}
              onClick={() => insertSnippet(s.tex)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className={styles.buttons}>
          <span className={styles.hint}>Ctrl/⌘+Enter 确认 · Esc 取消</span>
          <button className={styles.btnCancel} onClick={cancel}>取消</button>
          <button
            className={styles.btnConfirm}
            onClick={confirm}
            disabled={!tex.trim() || !!err}
          >
            插入
          </button>
        </div>
      </div>
    </div>
  )
}
