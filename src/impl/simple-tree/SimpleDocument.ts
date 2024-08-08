import {Document, NodeType} from '../../interfaces/dom-types.js';
import {SimpleDocumentType} from './SimpleDocumentType.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export class SimpleDocument extends SimpleParentNode implements Document {
  declare ownerDocument: null;
  declare parentNode: null;
  doctype: SimpleDocumentType | null;

  constructor() {
    super(NodeType.DOCUMENT_NODE, null);
    this.doctype = null;
  }
  get parentElement(): null {
    return null;
  }
  get previousSibling(): null {
    return null;
  }
  get nextSibling(): null {
    return null;
  }
  get nodeName(): string {
    return '#document';
  }
  get documentElement(): SimpleElement {
    return this.children[0];
  }
  get head(): SimpleElement {
    return this.documentElement.children[0];
  }
  get body(): SimpleElement {
    return this.documentElement.children[1];
  }
}