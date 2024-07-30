import {Attr, Document, Element} from '../../decl/xml-lite-decl.js';
import {NamespacedAttribute} from '../interfaces/tokens.js';
import {StaticElement} from './StaticElement.js';

export class StaticAttr implements Attr {
  readonly localName: string;
  readonly name: string;
  readonly namespaceURI: string | null;
  readonly ownerElement: Element;
  readonly prefix: string | null;
  readonly value: string | null;

  constructor(attr: NamespacedAttribute, ownerElement: StaticElement | null) {
    this.name = attr.name;
    this.namespaceURI = attr.namespaceURI ? attr.namespaceURI! : null;
    this.prefix = attr.prefix ? attr.prefix! : null;
    this.localName = attr.localName ? attr.localName! : attr.name;
    this.value = attr.value;
    this.ownerElement = ownerElement!;
  }

  get ownerDocument(): Document {
    return this.ownerElement.ownerDocument;
  }
}