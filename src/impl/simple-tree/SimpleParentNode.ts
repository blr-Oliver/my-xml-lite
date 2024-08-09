import nwsapi from 'nwsapi';
import {Element, NodeListOf, NodeType, ParentNode} from '../../interfaces/dom-types.js';
import {NS_HTML} from '../TreeComposer.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleNode} from './SimpleNode.js';
import {SimpleNodeList} from './SimpleNodeList.js';
import {SimpleTokenList} from './SimpleTokenList.js';

// TODO content from descendants should be cached
export abstract class SimpleParentNode extends SimpleNode implements ParentNode {
  children: SimpleNodeList<SimpleElement>;

  protected constructor(nodeType: NodeType, parent: SimpleParentNode | null) {
    super(nodeType, parent);
    this.children = new SimpleNodeList<SimpleElement>(0);
  }
  get nwsapi(): nwsapi.NWSAPI {
    return this.ownerDocument!.nwsapi;
  }
  get nodeValue(): string | null {
    return null;
  }
  get textContent(): string | null {
    const chunks: string[] = [];
    this.traverseNodes(node => {
      if (node.nodeType === NodeType.TEXT_NODE || node.nodeType === NodeType.CDATA_SECTION_NODE)
        chunks.push(node.nodeValue!);
    });
    return chunks.join('');
  }
  get firstElementChild(): SimpleElement | null {
    return this.children[0] || null;
  }
  get lastElementChild(): SimpleElement | null {
    return this.children[this.children.length - 1] || null;
  }
  get childElementCount(): number {
    return this.children.length;
  }

  querySelector(selectors: string): Element | null {
    return this.nwsapi.first(selectors, this as any) as Element | null;
  }
  querySelectorAll(selectors: string): NodeListOf<Element> {
    const elements = this.nwsapi.select(selectors, this as any);
    const len = elements.length;
    const result = new SimpleNodeList<Element>(len);
    for (let i = 0; i < len; ++i)
      result[i] = elements[i] as Element;
    return result;
  }
  getElementById(elementId: string): Element | null {
    let element = this.firstElementChild, next: SimpleElement | null;
    while (element) {
      if (element.id === elementId) return element;
      if (!(next = element.firstElementChild)) {
        while (!(next = element.nextElementSibling)) {
          if (!(element = element.parentElement)) break;
        }
      }
      element = next;
    }
    return null;
  }
  getElementsByClassName(classNames: string): SimpleNodeList<Element> {
    const classList = new SimpleTokenList(classNames);
    if (classList.length !== 0)
      return this.collectElements(element => classList.every(className => element.classList.contains(className)));
    else
      return new SimpleNodeList<Element>(0);
  }
  getElementsByName(name: string): SimpleNodeList<Element> {
    return this.collectElements(element => element.getAttribute('name') === name);
  }
  getElementsByTagName(qualifiedName: string): SimpleNodeList<Element> {
    if (qualifiedName === '*') return this.getElementsByTagNameNS('*', '*');
    const lowerName = qualifiedName.toLowerCase();
    return this.collectElements(element => element.namespaceURI === NS_HTML ? element.tagName === lowerName : element.tagName === qualifiedName);
  }
  getElementsByTagNameNS(namespace: string | null, localName: string): SimpleNodeList<Element> {
    const predicate = namespace === '*' ?
        (localName === '*' ? () => true : (element: SimpleElement) => element.localName === localName) :
        (localName === '*' ? (element: SimpleElement) => element.namespaceURI === namespace : (element: SimpleElement) => element.namespaceURI === namespace && element.localName === localName);
    return this.collectElements(predicate);
  }
  collectElements(predicate: (element: SimpleElement) => boolean): SimpleNodeList<Element> {
    const result = new SimpleNodeList<Element>(0);
    this.traverseElements(element => predicate(element) && result.push(element));
    return result;
  }
  traverseElements(callback: (element: SimpleElement) => void): void {
    const children = this.children;
    const len = children.length;
    for (let i = 0; i < len; ++i) {
      const child = children[i];
      callback(child);
      child.traverseElements(callback);
    }
  }
}