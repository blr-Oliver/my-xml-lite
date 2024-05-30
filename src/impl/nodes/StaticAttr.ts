import {Attr, Document, Element} from '../../decl/xml-lite-decl';
import {NamespacedAttribute} from '../tokens';

export class StaticAttr implements Attr {
  readonly localName: string;
  readonly name: string;
  readonly namespaceURI: string | null;
  readonly ownerElement: Element;
  readonly prefix: string | null;
  readonly value: string | null;

  constructor(attr: NamespacedAttribute, ownerElement: Element) {
    this.name = attr.name;
    this.namespaceURI = attr.namespaceURI ? null : attr.namespaceURI!;
    this.prefix = attr.prefix ? null : attr.prefix!;
    this.localName = attr.localName ? attr.name : attr.localName!;
    this.value = attr.value;
    this.ownerElement = ownerElement;
  }

  get ownerDocument(): Document {
    return this.ownerElement.ownerDocument;
  }
}