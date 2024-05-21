import {Element, Node, NodeList, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {StaticElement} from './StaticElement';
import {StaticEmptyNode} from './StaticEmptyNode';

export class StaticParentNode extends StaticEmptyNode implements ParentNode {
  readonly children: StaticElement[];

  constructor(nodeType: NodeType,
              parentNode: StaticParentNode | null,
              parentIndex: number,
              childNodes: Node[],
              children?: StaticElement[]) {
    super(nodeType, parentNode, parentIndex, childNodes);
    this.children = children || childNodes.filter(node => node.nodeType === NodeType.ELEMENT_NODE) as StaticElement[];
  }

  get nodeValue(): string | null {
    return null;
  }
  get firstChild(): Node | null {
    return this.childNodes[0] || null;
  }
  get lastChild(): Node | null {
    const len = this.childNodes.length;
    return len ? this.childNodes[len - 1] : null;
  }
  hasChildNodes(): boolean {
    return this.childNodes.length !== 0;
  }
  get childElementCount(): number {
    return this.children.length;
  }
  get firstElementChild(): Element | null {
    return this.children[0] || null;
  }
  get lastElementChild(): Element | null {
    const len = this.children.length;
    return len ? this.children[len - 1] : null;
  }

  getElementsByClassName(classes: string): NodeList<Element> {
    if (!classes) return [];
    const classList = classes.split(/\s+/);
    if (!classList.length) return [];
    const result: Element[] = [];
    this.traverseElementsFrom(this, element => {
      if (classList.every(cls => element.classList.contains(cls)))
        result.push(element);
    });
    return result;
  }
  getElementsByTagName(name: string): NodeList<Element> {
    const result: Element[] = [];
    this.traverseElementsFrom(this, element => {
      if (element.tagName === name)
        result.push(element);
    });
    return result;
  }

  protected traverseNodesFrom(root: Node, callback: (node: Node) => void) {
    const childNodes = root.childNodes;
    const len = childNodes.length;
    for (let i = 0; i < len; ++i) {
      const childNode = childNodes[i];
      callback(childNode);
      this.traverseNodesFrom(childNode, callback);
    }
  }
  protected traverseElementsFrom(root: ParentNode, callback: (element: Element) => void) {
    const children = root.children;
    const len = children.length;
    for (let i = 0; i < len; ++i) {
      const child = children[i];
      callback(child);
      this.traverseElementsFrom(child, callback);
    }
  }
}