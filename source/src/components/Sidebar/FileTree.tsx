import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLocale } from '../../hooks/useLocale'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { uniqueName } from '../../lib/fileTreeUtils'
import type { FileNode } from '../../types'
import styles from './FileTree.module.css'

interface CtxState {
  x: number
  y: number
  path: string[]
  type: 'file' | 'folder' | 'background'
}

// ─── Inline rename input ─────────────────────────────────────────
function RenameInput({
  defaultValue,
  onCommit,
  onCancel,
}: {
  defaultValue: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      className={styles.renameInput}
      defaultValue={defaultValue}
      autoFocus
      onBlur={(e) => {
        const v = e.target.value.trim()
        if (v && v !== defaultValue) onCommit(v)
        else onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const v = (e.target as HTMLInputElement).value.trim()
          if (v && v !== defaultValue) onCommit(v)
          else onCancel()
        }
        if (e.key === 'Escape') onCancel()
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

// ─── Drag-and-drop data key ──────────────────────────────────────
const DND_TYPE = 'application/x-shymd-path'

// ─── FileTreeItem ────────────────────────────────────────────────
interface FileTreeItemProps {
  node: FileNode
  depth: number
  path: string[]
  activeFile: string
  onFileClick: (name: string, content: string, path: string[], e: React.MouseEvent) => void
  onContext: (e: React.MouseEvent, path: string[], type: 'file' | 'folder') => void
  editingPath: string[] | null
  onRename: (path: string[], newName: string) => void
  onCancelRename: () => void
  onMove: (sourcePath: string[], destFolderPath: string[]) => void
  filter: string
  selectedPaths: string[][]
  onSelectToggle: (path: string[], additive: boolean) => void
}

function matchesFilter(node: FileNode, filter: string): boolean {
  if (!filter) return true
  if (node.type === 'file' && node.name.toLowerCase().includes(filter.toLowerCase())) {
    return true
  }
  if (node.type === 'folder' && node.children) {
    return node.children.some((c) => matchesFilter(c, filter))
  }
  return false
}

function pathsEqual(a: string[] | null, b: string[]): boolean {
  if (!a) return false
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function FileTreeItem({
  node,
  depth,
  path,
  activeFile,
  onFileClick,
  onContext,
  editingPath,
  onRename,
  onCancelRename,
  onMove,
  filter,
  selectedPaths,
  onSelectToggle,
}: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(true)
  const [dropOver, setDropOver] = useState(false)
  const dropDepthRef = useRef(0)
  const isEditing = pathsEqual(editingPath, path)
  const pathKey = path.join('/')
  const isSelected = selectedPaths.some((p) => p.join('/') === pathKey)

  if (!matchesFilter(node, filter)) return null

  // ── Drag source (files and folders) ──
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(path))
    e.dataTransfer.effectAllowed = 'move'
  }

  // ── Zone drop handlers (folder wrapper = folder row + all children) ──
  const onZoneDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_TYPE)) return
    e.preventDefault()
    dropDepthRef.current += 1
    setDropOver(true)
  }
  const onZoneDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const onZoneDragLeave = () => {
    dropDepthRef.current -= 1
    if (dropDepthRef.current <= 0) {
      dropDepthRef.current = 0
      setDropOver(false)
    }
  }
  const onZoneDrop = (e: React.DragEvent) => {
    dropDepthRef.current = 0
    setDropOver(false)
    const raw = e.dataTransfer.getData(DND_TYPE)
    if (!raw) return
    e.preventDefault()
    e.stopPropagation()
    try {
      const sourcePath: string[] = JSON.parse(raw)
      onMove(sourcePath, path)
    } catch { /* ignore */ }
  }

  if (node.type === 'folder') {
    const folderClass = `${styles.item} ${styles.folder}${dropOver ? ' ' + styles.dropTarget : ''}${isSelected ? ' ' + styles.itemSelected : ''}`
    return (
      <div
        className={styles.folderZone}
        onDragEnter={onZoneDragEnter}
        onDragOver={onZoneDragOver}
        onDragLeave={onZoneDragLeave}
        onDrop={onZoneDrop}
      >
        <div
          className={folderClass}
          style={{ paddingLeft: 12 + depth * 16 }}
          draggable
          onDragStart={onDragStart}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
              e.stopPropagation()
              onSelectToggle(path, true)
              return
            }
            setExpanded((x) => !x)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onContext(e, path, 'folder')
          }}
        >
          <span className={styles.arrow}>{expanded ? '▾' : '▸'}</span>
          <span className={styles.icon}>📁</span>
          {isEditing ? (
            <RenameInput
              defaultValue={node.name}
              onCommit={(n) => onRename(path, n)}
              onCancel={onCancelRename}
            />
          ) : (
            node.name
          )}
        </div>
        {expanded &&
          node.children?.map((child) => (
            <FileTreeItem
              key={child.name}
              node={child}
              depth={depth + 1}
              path={[...path, child.name]}
              activeFile={activeFile}
              onFileClick={onFileClick}
              onContext={onContext}
              editingPath={editingPath}
              onRename={onRename}
              onCancelRename={onCancelRename}
              onMove={onMove}
              filter={filter}
              selectedPaths={selectedPaths}
              onSelectToggle={onSelectToggle}
            />
          ))}
      </div>
    )
  }

  return (
    <div
      className={`${styles.item} ${activeFile === node.name ? styles.itemActive : ''}${isSelected ? ' ' + styles.itemSelected : ''}`}
      style={{ paddingLeft: 12 + depth * 16 }}
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          e.stopPropagation()
          onSelectToggle(path, true)
          return
        }
        if (node.content != null) onFileClick(node.name, node.content, path, e)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onContext(e, path, 'file')
      }}
    >
      <span className={styles.icon}>📄</span>
      {isEditing ? (
        <RenameInput
          defaultValue={node.name}
          onCommit={(n) => onRename(path, n)}
          onCancel={onCancelRename}
        />
      ) : (
        node.name
      )}
    </div>
  )
}

// ─── FileTree root ───────────────────────────────────────────────
export function FileTree({ filter = '' }: { filter?: string }) {
  const { t } = useLocale()
  const activeFile = useAppStore((s) => s.activeFile)
  const files = useAppStore((s) => s.files)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const createFile = useAppStore((s) => s.createFile)
  const createFolder = useAppStore((s) => s.createFolder)
  const deleteNode = useAppStore((s) => s.deleteNode)
  const renameNode = useAppStore((s) => s.renameNode)
  const moveNode = useAppStore((s) => s.moveNode)
  const selectedPaths = useAppStore((s) => s.selectedPaths)
  const toggleSelectPath = useAppStore((s) => s.toggleSelectPath)
  const clearSelectedPaths = useAppStore((s) => s.clearSelectedPaths)
  const deleteSelectedFromTree = useAppStore((s) => s.deleteSelectedFromTree)
  const [rootDropOver, setRootDropOver] = useState(false)

  const [ctx, setCtx] = useState<CtxState | null>(null)
  const editingPath = useAppStore((s) => s.editingPath)
  const setEditingPath = useAppStore((s) => s.setEditingPath)

  const handleFileClick = useCallback(
    (name: string, content: string) => {
      clearSelectedPaths()
      setActiveFile(name, content)
    },
    [setActiveFile, clearSelectedPaths]
  )

  const handleContext = useCallback(
    (e: React.MouseEvent, path: string[], type: 'file' | 'folder') => {
      setCtx({ x: e.clientX, y: e.clientY, path, type })
    },
    []
  )

  const handleBackgroundContext = useCallback(
    (e: React.MouseEvent) => {
      // Only trigger if clicking directly on the tree background (not a child)
      if (e.target === e.currentTarget) {
        e.preventDefault()
        setCtx({ x: e.clientX, y: e.clientY, path: [], type: 'background' })
      }
    },
    []
  )

  const closeCtx = useCallback(() => setCtx(null), [])

  // ─── Delete key on multi-selection (soft delete — memory only) ────
  const treeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedPaths.length === 0) return
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      // Only act if focus is within the sidebar tree (not inside the editor)
      const active = document.activeElement
      if (active && active.tagName === 'INPUT') return
      if (active && active.tagName === 'TEXTAREA') return
      if (active && (active as HTMLElement).isContentEditable) return
      const root = treeRef.current
      if (!root) return
      if (document.activeElement && !root.contains(document.activeElement) && document.activeElement !== document.body) return
      e.preventDefault()
      const names = selectedPaths.map((p) => p[p.length - 1]).join(', ')
      const msg = `${t('contextMenu.confirmDelete')} ${selectedPaths.length} ${t('contextMenu.items')}? (${names})`
      if (confirm(msg)) {
        deleteSelectedFromTree()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedPaths, deleteSelectedFromTree, t])

  // Helper to find children at a path in the file tree
  const findSiblings = (path: string[]): FileNode[] => {
    let current: FileNode[] = files
    for (const seg of path) {
      const folder = current.find((n) => n.name === seg && n.type === 'folder')
      if (!folder?.children) return current
      current = folder.children
    }
    return current
  }

  const ctxItems = (): ContextMenuItem[] => {
    if (!ctx) return []

    // When 2+ items are multi-selected and user right-clicks one of them,
    // offer a "Delete N items" action (memory-only, doesn't touch disk).
    const ctxKey = ctx.path.join('/')
    const rightClickedOnSelection =
      selectedPaths.length >= 2 && selectedPaths.some((p) => p.join('/') === ctxKey)
    if (rightClickedOnSelection) {
      return [
        {
          label: `${t('contextMenu.delete')} (${selectedPaths.length})`,
          onClick: () => {
            const names = selectedPaths.map((p) => p[p.length - 1]).join(', ')
            const msg = `${t('contextMenu.confirmDelete')} ${selectedPaths.length} ${t('contextMenu.items')}? (${names})`
            if (confirm(msg)) deleteSelectedFromTree()
          },
          danger: true,
        },
      ]
    }

    if (ctx.type === 'folder') {
      return [
        {
          label: t('contextMenu.newNote'),
          onClick: () => {
            const siblings = findSiblings(ctx.path)
            const finalName = uniqueName(siblings, t('contextMenu.untitledNote'))
            createFile(ctx.path, finalName)
            setEditingPath([...ctx.path, finalName])
          },
        },
        {
          label: t('contextMenu.newFolder'),
          onClick: () => {
            const siblings = findSiblings(ctx.path)
            const finalName = uniqueName(siblings, t('contextMenu.untitledFolder'))
            createFolder(ctx.path, finalName)
            setEditingPath([...ctx.path, finalName])
          },
        },
        { label: '', onClick: () => {}, separator: true },
        {
          label: t('contextMenu.rename'),
          onClick: () => setEditingPath(ctx.path),
        },
        {
          label: t('contextMenu.delete'),
          onClick: () => {
            if (confirm(`${t('contextMenu.confirmDelete')} "${ctx.path[ctx.path.length - 1]}"?`)) {
              deleteNode(ctx.path)
            }
          },
          danger: true,
        },
      ]
    }

    if (ctx.type === 'file') {
      return [
        {
          label: t('contextMenu.rename'),
          onClick: () => setEditingPath(ctx.path),
        },
        {
          label: t('contextMenu.delete'),
          onClick: () => {
            if (confirm(`${t('contextMenu.confirmDelete')} "${ctx.path[ctx.path.length - 1]}"?`)) {
              deleteNode(ctx.path)
            }
          },
          danger: true,
        },
      ]
    }

    // background
    return [
      {
        label: t('contextMenu.newNote'),
        onClick: () => {
          const finalName = uniqueName(files, t('contextMenu.untitledNote'))
          createFile([], finalName)
          setEditingPath([finalName])
        },
      },
      {
        label: t('contextMenu.newFolder'),
        onClick: () => {
          const finalName = uniqueName(files, t('contextMenu.untitledFolder'))
          createFolder([], finalName)
          setEditingPath([finalName])
        },
      },
    ]
  }

  // Drop on tree background → move to root
  const onRootDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_TYPE)) return
    // Only react if dragging over the background, not a child
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setRootDropOver(true)
  }
  const onRootDragLeave = (e: React.DragEvent) => {
    if (e.target === e.currentTarget) setRootDropOver(false)
  }
  const onRootDrop = (e: React.DragEvent) => {
    setRootDropOver(false)
    const raw = e.dataTransfer.getData(DND_TYPE)
    if (!raw) return
    e.preventDefault()
    try {
      const sourcePath: string[] = JSON.parse(raw)
      moveNode(sourcePath, []) // empty path = root
    } catch { /* ignore */ }
  }

  return (
    <div
      ref={treeRef}
      tabIndex={-1}
      className={`${styles.tree}${rootDropOver ? ' ' + styles.treeDropTarget : ''}`}
      onContextMenu={handleBackgroundContext}
      onDragOver={onRootDragOver}
      onDragLeave={onRootDragLeave}
      onDrop={onRootDrop}
      onClick={(e) => {
        // Click on blank area clears multi-selection
        if (e.target === e.currentTarget) clearSelectedPaths()
      }}
      style={{ minHeight: '100%' }}
    >
      {files.map((node) => (
        <FileTreeItem
          key={node.name}
          node={node}
          depth={0}
          path={[node.name]}
          activeFile={activeFile}
          onFileClick={handleFileClick}
          onContext={handleContext}
          editingPath={editingPath}
          onRename={(path, newName) => {
            renameNode(path, newName)
            setEditingPath(null)
          }}
          onCancelRename={() => setEditingPath(null)}
          onMove={moveNode}
          filter={filter}
          selectedPaths={selectedPaths}
          onSelectToggle={toggleSelectPath}
        />
      ))}
      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={ctxItems()}
          onClose={closeCtx}
        />
      )}
    </div>
  )
}
