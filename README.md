# Shymd

> 项目开发 7 天，使用 Claude Code 辅助完成全部代码编写。

一款轻量、免费、开源的 Markdown 桌面编辑器，灵感来自 [Typora](https://typora.io/)。  
**所见即所得**——你在编辑器里看到的样子，就是最终排版的样子，不需要在"代码"和"预览"之间来回切换。

---

## 这个软件能做什么

简单说：**写笔记、写文档、写博客文章**。

你用 Markdown 语法（用 `#` 表示标题、用 `**加粗**` 表示粗体……）写作，Shymd 会实时把它渲染成漂亮的排版。支持：

- 标题、段落、加粗、斜体、下划线、删除线、高亮
- 有序/无序列表、任务清单（打勾的 Todo）
- 引用块、代码块（180+ 编程语言高亮）、表格
- 数学公式（LaTeX 语法，行内 `$E=mc^2$` 或块级 `$$...$$`）
- 流程图 / 时序图 / 甘特图（Mermaid 语法）
- 文档目录（输入 `[TOC]` 自动生成）
- YAML Front Matter（文档元数据）
- 脚注、超链接、图片

---

## 下载与安装

前往 [Releases](../../releases) 页面，下载最新版本。提供两种方式：

### 方式一：便携版（推荐）

下载 **`Shymd.exe`**（约 13MB），放到任意文件夹，双击运行即可。

- 不需要安装，不写注册表，不改系统
- 想删除？直接删掉 `Shymd.exe` 就行，电脑上不留任何痕迹（除了你自己的笔记文件和浏览器缓存，见下方"完全卸载"）
- **要求**：Windows 10 或 11（系统自带 WebView2 运行时，一般不用额外装）

### 方式二：安装版（MSI）

下载 **`Shymd_x.x.x_x64_en-US.msi`**（约 6MB），双击按向导安装。

- 自定义选择安装路径，默认安装到 `C:\Program Files\Shymd\`
- 自动创建开始菜单快捷方式
- 可以在 **设置 → 应用 → 已安装的应用** 中卸载
- **注意**：MSI 安装会写入注册表

### 两种方式对比

|          | 便携版 (`exe`) | 安装版 (`msi`)       |
| -------- | ----------- | ----------------- |
| 需要安装吗    | 不需要，双击直接用   | 需要安装              |
| 写入注册表    | 否           | 是                 |
| 开始菜单快捷方式 | 无           | 有                 |
| 放在哪里     | 随意          | 固定在 Program Files |
| 删除方式     | 删文件         | 通过系统卸载            |

---

## 首次使用

1. 打开 Shymd，左侧有几篇示例笔记，可以随便点开看看
2. 第一次保存文件时（`Ctrl+S`），会弹出提示让你**设置文件存储路径**
3. 点击"浏览..."选一个文件夹（比如 `D:\我的笔记`），以后你的笔记就存在那里
4. 下载路径和缓存路径同理，按需配置

> **提示**：你也可以随时通过菜单栏 **文件 → 偏好设置**（或按 `Ctrl+,`）修改这些路径。

---

## 功能一览

### 三种编辑模式

| 模式   | 说明                      | 切换方式     |
| ---- | ----------------------- | -------- |
| 编辑模式 | 编辑时直接看到排版效果（默认模式）       | `Ctrl+/` |
| 源码模式 | 直接编辑 Markdown 源码，适合熟练用户 | `Ctrl+/` |
| 阅读模式 | 纯查看，不可编辑                | 菜单栏 → 视图 |

### 文件管理

- **侧边栏文件树**：打开一个文件夹，像文件管理器一样浏览所有 `.md` 文件
- **拖拽排序**：文件和文件夹可以拖动重新排列
- **右键菜单**：新建笔记、新建文件夹、重命名、删除
- **大纲导航**：侧边栏切到"大纲"页签，自动列出文档的标题结构，点击跳转
- **搜索过滤**：侧边栏顶部搜索框，输入关键字快速找到文件
- **最近文件**：菜单栏 → 文件 → 最近文件，快速打开最近编辑过的笔记

### 写作辅助

- **浮动工具栏**：选中文字后自动弹出格式栏（加粗、斜体、链接等）
- **表格插入器**：`Ctrl+T` 弹出网格，拖选行列数快速插入表格
- **搜索替换**：`Ctrl+F` 查找、`Ctrl+H` 替换，支持高亮定位
- **聚焦模式**：按 `F11`，隐藏所有 UI，只留编辑区，专注写作
- **打字机模式**：当前行始终保持在屏幕中央
- **字号缩放**：`Ctrl+=` 放大、`Ctrl+-` 缩小
- **自动保存**：停止输入 1 秒后自动保存（可在设置中调整或关闭）
- **外部文件拖入**：把 `.md` 文件直接拖进编辑区即可导入

### 外观

- **5 套主题**：亮色、暗色、莫兰迪、护眼绿、跟随系统
- **中英双语界面**：菜单栏 → 主题 → 语言切换
- **窗口记忆**：关闭时自动记住窗口位置和大小，下次打开恢复原样

---

## 常用快捷键

### 文件操作

| 快捷键            | 功能    |
| -------------- | ----- |
| `Ctrl+N`       | 新建笔记  |
| `Ctrl+O`       | 打开文件  |
| `Ctrl+Shift+O` | 打开文件夹 |
| `Ctrl+S`       | 保存    |
| `Ctrl+Shift+S` | 另存为   |

### 视图

| 快捷键                 | 功能                  |
| ------------------- | ------------------- |
| `Ctrl+/`            | 在"所见即所得"和"源码模式"之间切换 |
| `Ctrl+\`            | 显示/隐藏侧边栏            |
| `Ctrl+,`            | 打开偏好设置              |
| `F11`               | 聚焦模式（隐藏所有 UI）       |
| `Ctrl+=` / `Ctrl+-` | 放大 / 缩小字号           |

### 格式

| 快捷键                 | 功能       |
| ------------------- | -------- |
| `Ctrl+B`            | 加粗       |
| `Ctrl+I`            | 斜体       |
| `Ctrl+U`            | 下划线      |
| `Ctrl+1` ~ `Ctrl+6` | 标题 1~6 级 |
| `Ctrl+0`            | 恢复为正文段落  |
| `Ctrl+K`            | 插入超链接    |
| `Ctrl+T`            | 插入表格     |
| `` Ctrl+` ``        | 行内代码     |
| `Ctrl+Shift+K`      | 代码块      |
| `Ctrl+Shift+M`      | 数学公式块    |

### 编辑

| 快捷键            | 功能              |
| -------------- | --------------- |
| `Ctrl+F`       | 查找              |
| `Ctrl+H`       | 替换              |
| `Ctrl+Shift+C` | 复制为 Markdown 源码 |
| `Ctrl+Shift+V` | 粘贴为纯文本（去掉格式）    |

---

## 完全卸载教程

不想用了？下面教你怎么删干净，一点不留。

### 便携版卸载

1. 关闭 Shymd
2. 删除 `Shymd.exe` 文件
3. 删除你的笔记文件夹（就是你在偏好设置里配置的那个路径，比如 `D:\我的笔记`）
4. 删除浏览器缓存数据（包含你的设置和 localStorage）：
   - 按 `Win+R`，输入 `%LOCALAPPDATA%`，回车
   - 找到 `com.openshy.shymd` 文件夹，删除它
5. 完成，电脑上没有任何 Shymd 的痕迹了

### 安装版卸载

1. 关闭 Shymd
2. 打开 **设置 → 应用 → 已安装的应用**（或控制面板 → 程序和功能）
3. 找到 **Shymd**，点击 **卸载**
4. 这一步会删除程序文件和注册表信息，但**不会删除你的笔记和缓存**
5. 手动清理残留数据：
   - 删除你的笔记文件夹（偏好设置里配置的路径）
   - 按 `Win+R`，输入 `%LOCALAPPDATA%`，回车
   - 找到 `com.openshy.shymd` 文件夹，删除它
6. 完成，完全干净

> **为什么不自动删用户数据？** 因为里面有你的笔记和设置。万一误卸载了，笔记还在。这是所有主流软件（Chrome、VS Code、Typora）的通用做法。

---

## 技术栈

| 层               | 技术                                                                          | 版本       |
| --------------- | --------------------------------------------------------------------------- | -------- |
| 桌面框架            | [Tauri](https://v2.tauri.app/)                                              | 2.x      |
| 前端框架            | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | 19 / 6.0 |
| 构建工具            | [Vite](https://vite.dev/)                                                   | 8.x      |
| 状态管理            | [Zustand](https://zustand.docs.pmnd.rs/)                                    | 5.x      |
| 源码编辑器           | [CodeMirror](https://codemirror.net/)                                       | 6.x      |
| Markdown 解析     | [markdown-it](https://github.com/markdown-it/markdown-it) + 插件              | 14.x     |
| 数学渲染            | [KaTeX](https://katex.org/)                                                 | 0.16     |
| 代码高亮            | [highlight.js](https://highlightjs.org/)                                    | 11.x     |
| 图表渲染            | [Mermaid](https://mermaid.js.org/)                                          | 11.x     |
| HTML → Markdown | [Turndown](https://github.com/mixmark-io/turndown)                          | 7.x      |
| 样式              | CSS Modules + CSS Custom Properties                                         | —        |

---

## 从源码构建

> 以下内容面向开发者。普通用户直接下载 exe 即可，不需要看这部分。

### 环境要求

- **Node.js** 18+（推荐 20+）
- **Rust** 工具链（[安装 rustup](https://rustup.rs/)）
- **Windows 10/11**

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/OpenShy/Shymd.git
cd Shymd/source

# 2. 安装依赖
npm install

# 3. 开发模式
npm run dev          # 仅前端（浏览器预览，无文件系统功能）
npm run tauri dev    # 完整桌面应用（推荐）

# 4. 构建发行版
npm run tauri build
```

构建产物：

```
source/src-tauri/target/release/
├── app.exe                                ← 可执行文件
└── bundle/msi/Shymd_0.1.0_x64_en-US.msi  ← MSI 安装包
```

### 项目结构

```
Shymd/
├── Shymd.exe                   ← 便携版可执行文件
├── Shymd_0.1.0_x64_en-US.msi  ← MSI 安装包
├── README.md
└── source/                     ← 全部源代码
    ├── src/                    # 前端 (React + TypeScript)
    │   ├── components/         #   UI 组件
    │   ├── hooks/              #   React Hooks
    │   ├── lib/                #   核心工具库
    │   ├── stores/             #   状态管理
    │   ├── styles/             #   主题和样式
    │   └── locales/            #   中英文翻译
    ├── src-tauri/              # 桌面后端 (Rust)
    └── package.json
```

---

## 路线图

- [ ] macOS / Linux 支持
- [ ] 图片粘贴上传
- [ ] 导出为 PDF
- [ ] Git 集成（版本历史）
- [ ] 插件系统

---

## 许可证

[MIT](LICENSE)

---

## 致谢

本项目受 [Typora](https://typora.io/) 启发，感谢以下开源项目：

[Tauri](https://tauri.app/) · [React](https://react.dev/) · [CodeMirror](https://codemirror.net/) · [markdown-it](https://github.com/markdown-it/markdown-it) · [KaTeX](https://katex.org/) · [Mermaid](https://mermaid.js.org/) · [Turndown](https://github.com/mixmark-io/turndown)
