import type { FileNode } from '../types'
import { defaultDoc } from './defaultDoc'

export const sampleFiles: FileNode[] = [
  {
    name: '我的笔记',
    type: 'folder',
    children: [
      {
        name: '项目计划.md',
        type: 'file',
        content: defaultDoc,
      },
      {
        name: '学习笔记.md',
        type: 'file',
        content: `# 学习笔记

## React 核心概念

- **组件化**: UI 拆分为独立、可复用的组件
- **单向数据流**: 数据从父组件流向子组件
- **虚拟 DOM**: 通过 diff 算法高效更新真实 DOM

## TypeScript 类型系统

\`\`\`typescript
interface User {
  id: number
  name: string
  email?: string
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`
}
\`\`\`

> 类型是最好的文档。 —— TypeScript 团队
`,
      },
      {
        name: '读书摘要.md',
        type: 'file',
        content: `# 读书摘要

## 《代码整洁之道》

1. 有意义的命名比注释更重要
2. 函数应该只做一件事
3. 好的代码是自文档化的

## 《设计模式》

- **观察者模式**: 定义对象间一对多的依赖关系
- **策略模式**: 定义一系列算法，把它们封装起来
- **工厂模式**: 创建对象的接口，让子类决定实例化哪个类

---

*持续更新中…*
`,
      },
    ],
  },
  {
    name: '日记',
    type: 'folder',
    children: [
      {
        name: '2026-04-07.md',
        type: 'file',
        content: `# 2026年4月7日

## 今日计划

- [x] 完成 Shymd 编辑器 M2 阶段开发
- [x] 添加扩展语法支持
- [ ] 编写用户文档

## 心得体会

今天在实现 Markdown 编辑器的过程中，学到了很多关于 **CodeMirror 6** 的知识。它的 Compartment 模式非常优雅，可以动态切换主题而不需要重建编辑器实例。

$$
productivity = \\frac{features\\_completed}{time\\_spent}
$$
`,
      },
      {
        name: '2026-04-06.md',
        type: 'file',
        content: `# 2026年4月6日

## 项目启动

今天开始了 Shymd 项目的开发，目标是打造一个 **高仿 Typora** 的 Markdown 编辑器。

### 技术选型确认

| 技术 | 选择 | 理由 |
|------|------|------|
| 框架 | React 19 | 最新特性 |
| 构建 | Vite | 极速 HMR |
| 状态 | Zustand | 轻量简洁 |

> 万事开头难，但每一步都值得记录。
`,
      },
    ],
  },
  {
    name: '草稿',
    type: 'folder',
    children: [
      {
        name: '新想法.md',
        type: 'file',
        content: `# 新想法

## 未来功能规划

1. ==Mermaid 图表支持== — 流程图、序列图
2. ~~旧的渲染引擎~~ — 已替换为 markdown-it
3. **实时协作编辑** — WebSocket 同步
4. *自定义主题编辑器* — CSS 变量可视化调节

### 灵感来源

- Typora 的所见即所得体验
- VS Code 的扩展生态
- Notion 的块编辑器

---

*想到新点子随时补充…*
`,
      },
    ],
  },
]
