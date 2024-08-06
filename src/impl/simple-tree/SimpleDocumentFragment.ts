import {DocumentFragment, NodeType} from '../../decl/dom-like.js';
import {SimpleDocument} from './SimpleDocument.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export class SimpleDocumentFragment extends SimpleParentNode implements DocumentFragment {
  readonly #ownerDocument: SimpleDocument;

  constructor(ownerDocument: SimpleDocument) {
    super(NodeType.DOCUMENT_FRAGMENT_NODE, null);
    this.#ownerDocument = ownerDocument;
  }

  get nodeName(): string {
    return '#document-fragment';
  }

  get ownerDocument(): SimpleDocument {
    return this.#ownerDocument;
  }
}