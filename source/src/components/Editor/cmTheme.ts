import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/* ---------- Light theme ---------- */

// All CM theme colours route through CSS custom properties so source
// mode visually adopts whichever of the 8 themes (light / dark /
// morandi / eye-care / monokai / dracula / solarized-light / one-dark)
// the user picks. Without this, source mode looked permanently
// "default light" or "default dark" regardless of theme choice — which
// is what the user reported as 「字体不匹配」.
const lightEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '15px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent)',
    lineHeight: '1.7',
    padding: '16px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--color-selection)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--color-active)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-sidebar-bg)',
    color: 'var(--color-text-secondary)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--color-active)',
    color: 'var(--color-text)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-code-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--color-selection)',
    outline: 'none',
  },
}, { dark: false })

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.4em', color: '#1A1A1A' },
  { tag: tags.heading2, fontWeight: '600', fontSize: '1.2em', color: '#1A1A1A' },
  { tag: tags.heading3, fontWeight: '600', fontSize: '1.1em', color: '#1A1A1A' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: '#1A1A1A' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#6B6B6B' },
  { tag: tags.strong, fontWeight: '700', color: '#1A1A1A' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#999' },
  { tag: tags.keyword, color: '#D4775C' },
  { tag: [tags.atom, tags.bool], color: '#D4775C' },
  { tag: tags.number, color: '#B5695C' },
  { tag: tags.string, color: '#6A8759' },
  { tag: tags.comment, color: '#999', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#4A7FB5' },
  { tag: [tags.function(tags.variableName)], color: '#B07D48' },
  { tag: tags.definition(tags.variableName), color: '#4A7FB5' },
  { tag: tags.propertyName, color: '#9876AA' },
  { tag: tags.operator, color: '#888' },
  { tag: tags.meta, color: '#999' },
  { tag: tags.link, color: '#4A7FB5', textDecoration: 'underline' },
  { tag: tags.url, color: '#4A7FB5' },
  { tag: tags.monospace, fontFamily: '"JetBrains Mono", monospace', color: '#D4775C', backgroundColor: '#F4F1EE', borderRadius: '3px' },
  { tag: tags.quote, color: '#6B6B6B', fontStyle: 'italic' },
  { tag: tags.processingInstruction, color: '#888' },
])

export const lightTheme = [lightEditorTheme, syntaxHighlighting(lightHighlight)]

/* ---------- Dark theme ---------- */

const darkEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '15px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent)',
    lineHeight: '1.7',
    padding: '16px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--color-selection)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--color-active)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-sidebar-bg)',
    color: 'var(--color-text-secondary)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--color-active)',
    color: 'var(--color-text)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-code-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--color-selection)',
    outline: 'none',
  },
}, { dark: true })

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.4em', color: '#F5F5F5' },
  { tag: tags.heading2, fontWeight: '600', fontSize: '1.2em', color: '#F5F5F5' },
  { tag: tags.heading3, fontWeight: '600', fontSize: '1.1em', color: '#F5F5F5' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: '#F5F5F5' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#999' },
  { tag: tags.strong, fontWeight: '700', color: '#F5F5F5' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#666' },
  { tag: tags.keyword, color: '#E8956A' },
  { tag: [tags.atom, tags.bool], color: '#E8956A' },
  { tag: tags.number, color: '#D19A66' },
  { tag: tags.string, color: '#98C379' },
  { tag: tags.comment, color: '#666', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#6BA3D6' },
  { tag: [tags.function(tags.variableName)], color: '#D19A66' },
  { tag: tags.definition(tags.variableName), color: '#6BA3D6' },
  { tag: tags.propertyName, color: '#C678DD' },
  { tag: tags.operator, color: '#888' },
  { tag: tags.meta, color: '#777' },
  { tag: tags.link, color: '#6BA3D6', textDecoration: 'underline' },
  { tag: tags.url, color: '#6BA3D6' },
  { tag: tags.monospace, fontFamily: '"JetBrains Mono", monospace', color: '#E8956A', backgroundColor: '#2D2D2D', borderRadius: '3px' },
  { tag: tags.quote, color: '#999', fontStyle: 'italic' },
  { tag: tags.processingInstruction, color: '#777' },
])

export const darkTheme = [darkEditorTheme, syntaxHighlighting(darkHighlight)]
