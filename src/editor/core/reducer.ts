import type { Command } from './commands'
import { mergeStyleLayer } from './styles'
import {
  cloneWithNewIds,
  findNode,
  findParent,
  insertNode,
  isDescendant,
  removeNode,
  updateNode,
} from './tree'
import { canInsertNode } from './rules'
import type { PageDocument } from './types'

/**
 * Pure reducer over the page document. Returns the *same* reference when a
 * command is a no-op, which lets the store skip a history entry.
 */
export function applyCommand(page: PageDocument, command: Command): PageDocument {
  switch (command.type) {
    case 'UPDATE_PAGE_META': {
      const name = command.patch.name
      if (typeof name !== 'string' || name === page.name) return page
      return { ...page, name, updatedAt: new Date().toISOString() }
    }
    case 'SELECT_NODE':
      // Pure view state — the store handles it, the document is untouched.
      return page

    case 'ADD_NODE': {
      const parent = findNode(page.root, command.parentId)
      if (!parent) return page
      // Same rule table the canvas and the layers panel hit-test against.
      if (!canInsertNode(parent.type, command.node.type)) return page
      return touch(page, insertNode(page.root, command.parentId, command.node, command.index))
    }

    case 'DELETE_NODE': {
      if (command.nodeId === page.root.id) return page
      const { root, removed } = removeNode(page.root, command.nodeId)
      if (!removed) return page
      return touch(page, root)
    }

    case 'DUPLICATE_NODE': {
      if (command.nodeId === page.root.id) return page
      const target = findNode(page.root, command.nodeId)
      const parent = findParent(page.root, command.nodeId)
      if (!target || !parent || !parent.children) return page
      const index = parent.children.findIndex((child) => child.id === command.nodeId)
      const copy = cloneWithNewIds(target)
      return touch(page, insertNode(page.root, parent.id, copy, index + 1))
    }

    case 'MOVE_NODE': {
      if (command.nodeId === page.root.id) return page
      if (command.nodeId === command.parentId) return page
      // Never allow a node to be moved inside its own subtree.
      if (isDescendant(page.root, command.nodeId, command.parentId)) return page
      const destination = findNode(page.root, command.parentId)
      const moving = findNode(page.root, command.nodeId)
      if (!destination || !moving) return page
      if (!canInsertNode(destination.type, moving.type)) return page

      const { root, removed, parentId, index } = removeNode(page.root, command.nodeId)
      if (!removed) return page
      const sameParent = parentId === command.parentId
      const target = sameParent && index < command.index ? command.index - 1 : command.index
      if (sameParent && target === index) return page
      return touch(page, insertNode(root, command.parentId, removed, target))
    }

    case 'UPDATE_PROPS': {
      const target = findNode(page.root, command.nodeId)
      if (!target) return page
      const root = updateNode(page.root, command.nodeId, (node) => ({
        ...node,
        props: { ...node.props, ...command.patch },
      }))
      return root === page.root ? page : touch(page, root)
    }

    case 'UPDATE_STYLE': {
      const target = findNode(page.root, command.nodeId)
      if (!target) return page
      const root = updateNode(page.root, command.nodeId, (node) => ({
        ...node,
        styles: mergeStyleLayer(node.styles, command.device, command.patch),
      }))
      return root === page.root ? page : touch(page, root)
    }
  }
}

function touch(page: PageDocument, root: PageDocument['root']): PageDocument {
  if (root === page.root) return page
  return { ...page, root, updatedAt: new Date().toISOString() }
}
