import {TemplateElement} from '../../decl/dom-like.js';
import {TagToken} from '../interfaces/tokens.js';
import {SimpleDocumentFragment} from './SimpleDocumentFragment.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export class SimpleTemplate extends SimpleElement implements TemplateElement {
  content: SimpleDocumentFragment;

  constructor(parentNode: SimpleParentNode, token: TagToken, namespaceURI: string | null, content: SimpleDocumentFragment) {
    super(parentNode, token, namespaceURI);
    this.content = content;
  }
}