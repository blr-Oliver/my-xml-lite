import nwsapi from 'nwsapi';
import {Document, NodeType} from '../../interfaces/dom-types.js';
import {TokenType} from '../interfaces/tokens.js';
import {NS_HTML} from '../TreeComposer.js';
import {SimpleDocumentType} from './SimpleDocumentType.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleParentNode} from './SimpleParentNode.js';

function acquireDOMException(): nwsapi.Global['DOMException'] {
  if (typeof (globalThis) !== 'undefined') {
    if ('DOMException' in globalThis)
      return (globalThis as any)['DOMException'] as nwsapi.Global['DOMException'];
  }
  return polyfillDOMException();
}

function polyfillDOMException(): nwsapi.Global['DOMException'] {
  return class DOMException extends Error {
    name: string;
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || '';
    }
  } as unknown as nwsapi.Global['DOMException'];
}

const DOMException: nwsapi.Global['DOMException'] = acquireDOMException();

export class SimpleDocument extends SimpleParentNode implements Document {
  declare ownerDocument: null;
  declare parentNode: null;
  doctype: SimpleDocumentType | null;
  readonly #nwsapi: nwsapi.NWSAPI;

  constructor() {
    super(NodeType.DOCUMENT_NODE, null);
    this.doctype = null;
    this.#nwsapi = nwsapi({
      document: this as unknown as nwsapi.Global['document'],
      DOMException: DOMException
    });
    this.#nwsapi.configure({LOGERRORS: false, VERBOSITY: false});
  }

  get contentType(): string {
    return 'text/html';
  }
  get compatMode(): string {
    return 'CSS1Compat';
  }
  get textContent(): null {
    return null;
  }
  get nwsapi(): nwsapi.NWSAPI {
    return this.#nwsapi;
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
  createElement(tagName: string): SimpleElement {
    return new SimpleElement(null, {
      type: TokenType.START_TAG,
      name: tagName.toLowerCase(), // FIXME
      selfClosed: false,
      attributes: []
    }, NS_HTML);
  }
}