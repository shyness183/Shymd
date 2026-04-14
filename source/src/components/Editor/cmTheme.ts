import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/* ---------- Light theme ---------- */

const lightEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#FAFAF9',
    color: '#2C2C2C',
    fontSize: '15px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },
  '.cm-content': {
    caretColor: '#D4775C',
    lineHeight: '1.7',
    padding: '16px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#D4775C' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(212, 119, 92, 0.15)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.03)' },
  '.cm-gutters': {
    backgroundColor: '#F0EFED',
    color: '#999',
    border: 'none',
    borderRight: '1px solid #E5E5E5',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: '#2C2C2C',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#F4F1EE',
    border: '1px solid #E5E5E5',
    color: '#999',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(212, 119, 92, 0.2)',
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
    backgroundColor: '#1E1E1E',
    color: '#D4D4D4',
    fontSize: '15px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },
  '.cm-content': {
    caretColor: '#E8956A',
    lineHeight: '1.7',
    padding: '16px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#E8956A' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(232, 149, 106, 0.2)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  '.cm-gutters': {
    backgroundColor: '#252525',
    color: '#666',
    border: 'none',
    borderRight: '1px solid #404040',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#D4D4D4',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#2D2D2D',
    border: '1px solid #404040',
    color: '#666',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(232, 149, 106, 0.25)',
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
