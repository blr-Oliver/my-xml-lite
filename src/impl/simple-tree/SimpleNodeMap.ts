import {NamedNodeMap} from '../../interfaces/dom-types.js';
import {NamespacedAttribute} from '../interfaces/tokens.js';
import {SimpleAttr} from './SimpleAttr.js';
import {SimpleElement} from './SimpleElement.js';

export class SimpleNodeMap extends Array<SimpleAttr> implements NamedNodeMap {
  readonly #namedMap: Map<string, SimpleAttr>;
  readonly names: string[];

  constructor(ownerElement: SimpleElement, attributes: NamespacedAttribute[]) {
    const count = attributes.length;
    super(count);
    const map = this.#namedMap = new Map<string, SimpleAttr>();
    const names = this.names = new Array(count);
    for (let i = 0; i < count; ++i) {
      const attribute = attributes[i];
      const name = names[i] = attribute.name;
      const attr = this[i] = new SimpleAttr(ownerElement, attribute, i);
      map.set(name, attr);
      if (!(name in this))
        (this as any)[name] = attr;
    }
  }

  addAttribute(ownerElement: SimpleElement, attribute: NamespacedAttribute) {
    const name = attribute.name;
    if (!this.#namedMap.has(name)) {
      const attr = new SimpleAttr(ownerElement, attribute, this.length);
      this.push(attr);
      this.names.push(name);
      this.#namedMap.set(name, attr);
      if (!(name in this))
        (this as any)[name] = attr;
    }
  }
  item(index: number): SimpleAttr | null {
    return this[index] || null;
  }
  getNamedItem(qualifiedName: string): SimpleAttr | null {
    return this.#namedMap.get(qualifiedName) || null;
  }
  getNamedItemNS(namespace: string | null, localName: string): SimpleAttr | null {
    namespace = namespace || null;
    // TODO maybe lookup namespace and compute qualifiedName
    return this.find(attr => attr.namespaceURI === namespace && attr.localName === localName) || null;
  }
}