/**
 * Slash command registry — the single source of truth for the "/ to
 * insert" menu. Source mode and WYSIWYG mode each provide their own
 * executor for the same logical command so the user sees the same
 * list regardless of editor surface.
 *
 * Keywords include both English and Chinese terms so "/标题" and
 * "/heading" both match.
 */
import {
  cmdHeading, cmdParagraph, cmdQuote, cmdUnorderedList,
  cmdOrderedList, cmdTaskList, cmdCodeBlock, cmdMathBlock,
  cmdHorizontalRule, cmdImage,
} from './editorCommands'
import {
  htmlHeading, htmlParagraph, htmlQuote, htmlUnorderedList,
  htmlOrderedList, htmlTaskList, htmlCodeBlock, htmlMathBlock,
  htmlHorizontalRule, htmlImage,
} from './htmlEditorCommands'

export interface SlashCommand {
  id: string
  labelZh: string
  labelEn: string
  /** Lowercased tokens we match the user's query against. */
  keywords: string[]
  /** Single unicode char or short string shown in the left column. */
  icon: string
  /** Short explanation shown below the label. */
  hintZh: string
  hintEn: string
  /** Runs the command in the matching editor context. */
  execSource: () => void
  execHtml: () => void
}

// NOTE on "table" — the WYSIWYG side already has a rich row×col picker
// (TablePicker). Rather than duplicate it here, this entry opens the
// picker via its zustand store.
async function openTablePicker() {
  const { useAppStore } = await import('../stores/useAppStore')
  useAppStore.getState().setTablePickerOpen(true)
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'paragraph',
    labelZh: '段落', labelEn: 'Paragraph',
    keywords: ['paragraph', 'p', 'text', '段落', '正文'],
    icon: '¶',
    hintZh: '普通正文', hintEn: 'Plain text',
    execSource: cmdParagraph, execHtml: htmlParagraph,
  },
  {
    id: 'h1',
    labelZh: '标题 1', labelEn: 'Heading 1',
    keywords: ['h1', 'heading', 'title', 'header', '标题', '标题1'],
    icon: 'H₁',
    hintZh: '大标题', hintEn: 'Large section title',
    execSource: () => cmdHeading(1), execHtml: () => htmlHeading(1),
  },
  {
    id: 'h2',
    labelZh: '标题 2', labelEn: 'Heading 2',
    keywords: ['h2', 'heading', '标题', '标题2'],
    icon: 'H₂',
    hintZh: '二级标题', hintEn: 'Medium section title',
    execSource: () => cmdHeading(2), execHtml: () => htmlHeading(2),
  },
  {
    id: 'h3',
    labelZh: '标题 3', labelEn: 'Heading 3',
    keywords: ['h3', 'heading', '标题', '标题3'],
    icon: 'H₃',
    hintZh: '三级标题', hintEn: 'Small section title',
    execSource: () => cmdHeading(3), execHtml: () => htmlHeading(3),
  },
  {
    id: 'ul',
    labelZh: '无序列表', labelEn: 'Bulleted List',
    keywords: ['list', 'ul', 'bullet', 'unordered', '列表', '无序'],
    icon: '•',
    hintZh: '项目列表', hintEn: 'Simple bullet list',
    execSource: cmdUnorderedList, execHtml: htmlUnorderedList,
  },
  {
    id: 'ol',
    labelZh: '有序列表', labelEn: 'Numbered List',
    keywords: ['list', 'ol', 'ordered', 'number', '有序', '编号'],
    icon: '1.',
    hintZh: '编号列表', hintEn: 'Numbered list',
    execSource: cmdOrderedList, execHtml: htmlOrderedList,
  },
  {
    id: 'todo',
    labelZh: '任务列表', labelEn: 'Task List',
    keywords: ['todo', 'task', 'checkbox', 'check', '任务', '清单', '待办'],
    icon: '☐',
    hintZh: '可勾选待办', hintEn: 'Checkbox list',
    execSource: cmdTaskList, execHtml: htmlTaskList,
  },
  {
    id: 'quote',
    labelZh: '引用', labelEn: 'Quote',
    keywords: ['quote', 'blockquote', 'cite', '引用'],
    icon: '❝',
    hintZh: '块引用', hintEn: 'Block quotation',
    execSource: cmdQuote, execHtml: htmlQuote,
  },
  {
    id: 'code',
    labelZh: '代码块', labelEn: 'Code Block',
    keywords: ['code', 'codeblock', 'pre', 'snippet', '代码', '代码块'],
    icon: '{}',
    hintZh: '多行代码', hintEn: 'Multi-line code',
    execSource: cmdCodeBlock, execHtml: htmlCodeBlock,
  },
  {
    id: 'math',
    labelZh: '数学公式', labelEn: 'Math',
    keywords: ['math', 'latex', 'equation', 'formula', 'katex', '数学', '公式', '方程'],
    icon: '∑',
    hintZh: 'LaTeX 公式', hintEn: 'LaTeX formula',
    execSource: cmdMathBlock, execHtml: htmlMathBlock,
  },
  {
    id: 'image',
    labelZh: '图片', labelEn: 'Image',
    keywords: ['image', 'img', 'picture', 'photo', '图片', '图像'],
    icon: '🖼',
    hintZh: '插入图片', hintEn: 'Insert image',
    execSource: cmdImage, execHtml: htmlImage,
  },
  {
    id: 'table',
    labelZh: '表格', labelEn: 'Table',
    keywords: ['table', 'grid', '表格'],
    icon: '⊞',
    hintZh: '打开表格选择器', hintEn: 'Open table picker',
    execSource: openTablePicker, execHtml: openTablePicker,
  },
  {
    id: 'hr',
    labelZh: '分割线', labelEn: 'Divider',
    keywords: ['hr', 'divider', 'rule', 'separator', '分割线', '分隔线'],
    icon: '—',
    hintZh: '水平分割线', hintEn: 'Horizontal rule',
    execSource: cmdHorizontalRule, execHtml: htmlHorizontalRule,
  },
]

/**
 * Filter commands by user query. Case-insensitive, accepts both EN and
 * ZH terms. Empty query → return all.
 */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter((c) => {
    const hay = [c.labelZh, c.labelEn, ...c.keywords, c.id]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}
