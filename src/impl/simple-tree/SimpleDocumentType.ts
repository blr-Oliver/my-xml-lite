import {DocumentType, NodeType} from '../../decl/dom-like.js';
import {SimpleChildNode} from './SimpleChildNode.js';
import {SimpleDocument} from './SimpleDocument.js';

export class SimpleDocumentType extends SimpleChildNode implements DocumentType {
  declare parentNode: SimpleDocument;
  readonly name: string;
  readonly publicId: string;
  readonly systemId: string;

  constructor(parent: SimpleDocument, name: string, publicId: string, systemId: string) {
    super(NodeType.DOCUMENT_TYPE_NODE, parent);
    this.name = name;
    this.publicId = publicId;
    this.systemId = systemId;
  }

  get ownerDocument(): SimpleDocument {
    return this.parentNode;
  }
  get parentElement(): null {
    return null;
  }
  get firstChild(): null {
    return null;
  }
  get lastChild(): null {
    return null;
  }
  get nodeName(): string {
    return this.name;
  }
  get nodeValue(): null {
    return null;
  }
}