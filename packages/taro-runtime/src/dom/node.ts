import { NodeType } from './node_types'
import { incrementId } from '../utils'
import { TaroEventTarget } from './event_target'
import { eventSource } from './event'
import { TaroRootElement } from './root'
import { Shortcuts, invariant } from '@tarojs/shared'
import { hydrate, HydratedData } from '../render'
import { TaroElement } from './element'

const nodeId = incrementId()

export interface UpdatePayload {
  path: string;
  value: UpdatePayloadValue
}

export type UpdatePayloadValue = string | boolean | HydratedData

export class TaroNode extends TaroEventTarget {
  public nodeType: NodeType

  public nodeName: string

  public uid: string

  public parentNode: TaroNode | null = null

  public childNodes: TaroNode[] = []

  public constructor (nodeType: NodeType, nodeName: string) {
    super()
    this.nodeType = nodeType
    this.nodeName = nodeName
    this.uid = `_n_${nodeId()}`
    eventSource.set(this.uid, this)
  }

  public get _path () {
    if (this.parentNode !== null) {
      return `${this.parentNode._path}.${Shortcuts.Childnodes}.[${this.parentNode.childNodes.indexOf(this)}]`
    }

    return ''
  }

  protected get _root (): TaroRootElement | null {
    if (this.parentNode !== null) {
      return this.parentNode._root
    }

    return null
  }

  public get nextSibling () {
    const parentNode = this.parentNode
    if (parentNode) {
      return parentNode.childNodes[this.findIndex(parentNode.childNodes, this) + 1] || null
    }

    return null
  }

  public get previousSibling () {
    const parentNode = this.parentNode
    if (parentNode) {
      return parentNode.childNodes[this.findIndex(parentNode.childNodes, this) - 1]
    }
  }

  public insertBefore<T extends TaroNode> (newChild: T, refChild?: TaroNode | null, isReplace?: boolean): T {
    newChild.remove()
    newChild.parentNode = this
    let payload: UpdatePayload
    if (refChild) {
      const index = this.findIndex(this.childNodes, refChild)
      this.childNodes.splice(index, 0, newChild)
      if (isReplace === true) {
        payload = {
          path: newChild._path,
          value: this.hydrate(newChild)
        }
      } else {
        payload = {
          path: `${this._path}.${Shortcuts.Childnodes}`,
          value: () => this.childNodes.map(hydrate)
        }
      }
    } else {
      this.childNodes.push(newChild)
      payload = {
        path: newChild._path,
        value: this.hydrate(newChild)
      }
    }

    this.enqueueUpdate(payload)
    return newChild
  }

  private hydrate = (node: TaroNode) => () => hydrate(node as TaroElement)

  public appendChild (child: TaroNode) {
    this.insertBefore(child)
  }

  public replaceChild (newChild: TaroNode, oldChild: TaroNode) {
    if (oldChild.parentNode === this) {
      this.insertBefore(newChild, oldChild, true)
      oldChild.remove(true)
      return oldChild
    }
  }

  public removeChild<T extends TaroNode> (child: T, isReplace?: boolean): T {
    const index = this.findIndex(this.childNodes, child)
    this.childNodes.splice(index, 1)
    if (isReplace !== true) {
      this.enqueueUpdate({
        path: `${this._path}.${Shortcuts.Childnodes}`,
        value: () => this.childNodes.map(hydrate)
      })
    }
    child.parentNode = null
    eventSource.delete(this.uid)
    return child
  }

  public remove (isReplace?: boolean) {
    if (this.parentNode) {
      this.parentNode.removeChild(this, isReplace)
    }
  }

  public get firstChild () {
    return this.childNodes[0]
  }

  public get lastChild () {
    const c = this.childNodes
    return c[c.length - 1]
  }

  public hasChildNodes () {
    return this.childNodes.length > 0
  }

  public enqueueUpdate (payload: UpdatePayload) {
    if (this._root === null) {
      return
    }

    this._root.enqueueUpdate(payload)
  }

  /**
   * @textContent 目前只能置空子元素
   * @TODO 等待完整 innerHTML 实现
   */
  public set textContent (text: string) {
    if (text === '') {
      while (this.childNodes.length > 0) {
        this.childNodes[0].remove()
      }
    }
  }

  protected findIndex (childeNodes: TaroNode[], refChild: TaroNode) {
    const index = childeNodes.indexOf(refChild)
    invariant(index !== -1, 'The node to be replaced is not a child of this node.')

    return index
  }
}