import type { FileNode } from '../types'

/** Deep-clone a FileNode tree (immutable updates). */
function cloneTree(tree: FileNode[]): FileNode[] {
  return tree.map((n) => ({
    ...n,
    children: n.children ? cloneTree(n.children) : undefined,
  }))
}

/**
 * Find the children array at `parentPath`.
 * An empty parentPath returns the root array wrapper.
 * Mutates the cloned tree in place — always call on a cloned tree.
 */
function findChildren(
  tree: FileNode[],
  parentPath: string[],
): FileNode[] | null {
  if (parentPath.length === 0) return tree
  let current: FileNode[] = tree
  for (const seg of parentPath) {
    const node = current.find((n) => n.name === seg && n.type === 'folder')
    if (!node || !node.children) return null
    current = node.children
  }
  return current
}

/** Insert a new node under parentPath. */
export function insertNode(
  tree: FileNode[],
  parentPath: string[],
  node: FileNode,
): FileNode[] {
  const clone = cloneTree(tree)
  const parent = findChildren(clone, parentPath)
  if (parent) parent.push(node)
  return clone
}

/** Remove a node at the given path (last element is the node name). */
export function removeNode(
  tree: FileNode[],
  path: string[],
): FileNode[] {
  if (path.length === 0) return tree
  const clone = cloneTree(tree)
  const parentPath = path.slice(0, -1)
  const name = path[path.length - 1]
  const parent = findChildren(clone, parentPath)
  if (parent) {
    const idx = parent.findIndex((n) => n.name === name)
    if (idx !== -1) parent.splice(idx, 1)
  }
  return clone
}

/** Rename a node at the given path. */
export function renameNodeInTree(
  tree: FileNode[],
  path: string[],
  newName: string,
): FileNode[] {
  if (path.length === 0) return tree
  const clone = cloneTree(tree)
  const parentPath = path.slice(0, -1)
  const name = path[path.length - 1]
  const parent = findChildren(clone, parentPath)
  if (parent) {
    const node = parent.find((n) => n.name === name)
    if (node) node.name = newName
  }
  return clone
}

/** Update file content by walking the entire tree to find a file by name.
 *  DEPRECATED — prefer `updateContentByPath` which is unambiguous with duplicate names. */
export function updateContentByName(
  tree: FileNode[],
  fileName: string,
  content: string,
): FileNode[] {
  const clone = cloneTree(tree)
  const stack: FileNode[] = [...clone]
  while (stack.length) {
    const node = stack.pop()!
    if (node.type === 'file' && node.name === fileName) {
      node.content = content
      return clone
    }
    if (node.children) stack.push(...node.children)
  }
  return clone
}

/** Update file content at an exact path. Safe against duplicate filenames. */
export function updateContentByPath(
  tree: FileNode[],
  path: string[],
  content: string,
): FileNode[] {
  if (path.length === 0) return tree
  const clone = cloneTree(tree)
  const parentPath = path.slice(0, -1)
  const name = path[path.length - 1]
  const parent = findChildren(clone, parentPath)
  if (!parent) return clone
  const node = parent.find((n) => n.name === name && n.type === 'file')
  if (node) node.content = content
  return clone
}

/** Find a node at an exact path. Returns null if not found. */
export function findNodeByPath(
  tree: FileNode[],
  path: string[],
): FileNode | null {
  if (path.length === 0) return null
  let current: FileNode[] = tree
  let node: FileNode | null = null
  for (const seg of path) {
    node = current.find((n) => n.name === seg) ?? null
    if (!node) return null
    if (node.children) current = node.children
  }
  return node
}

/** True when `prefix` is equal to or a parent of `path`. */
export function pathIsPrefix(prefix: string[], path: string[]): boolean {
  if (prefix.length > path.length) return false
  return prefix.every((s, i) => s === path[i])
}

/**
 * Move a node from `sourcePath` into `destFolderPath`.
 * If the destination already has a node with the same name, a unique name is generated.
 * Returns the updated tree or `null` if the move is invalid (e.g. moving a folder into itself).
 */
export function moveNode(
  tree: FileNode[],
  sourcePath: string[],
  destFolderPath: string[],
): FileNode[] | null {
  if (sourcePath.length === 0) return null
  const srcName = sourcePath[sourcePath.length - 1]
  const srcParent = sourcePath.slice(0, -1)

  // No-op if source is already in dest
  if (
    srcParent.length === destFolderPath.length &&
    srcParent.every((s, i) => s === destFolderPath[i])
  ) {
    return null
  }

  // Prevent moving a folder into itself or a descendant
  if (
    destFolderPath.length >= sourcePath.length &&
    sourcePath.every((s, i) => s === destFolderPath[i])
  ) {
    return null
  }

  const clone = cloneTree(tree)

  // Find and remove from source
  const srcParentChildren = findChildren(clone, srcParent)
  if (!srcParentChildren) return null
  const idx = srcParentChildren.findIndex((n) => n.name === srcName)
  if (idx === -1) return null
  const [node] = srcParentChildren.splice(idx, 1)

  // Find destination
  const destChildren = findChildren(clone, destFolderPath)
  if (!destChildren) return null

  // Handle name collision
  node.name = uniqueName(destChildren, node.name)
  destChildren.push(node)

  return clone
}

/** Generate a unique name if there's a collision (e.g. "Untitled (2).md"). */
export function uniqueName(
  siblings: FileNode[],
  baseName: string,
): string {
  const names = new Set(siblings.map((n) => n.name))
  if (!names.has(baseName)) return baseName
  const dot = baseName.lastIndexOf('.')
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName
  const ext = dot > 0 ? baseName.slice(dot) : ''
  let i = 2
  while (names.has(`${stem} (${i})${ext}`)) i++
  return `${stem} (${i})${ext}`
}
