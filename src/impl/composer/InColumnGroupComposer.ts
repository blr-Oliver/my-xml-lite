import {StaticElement} from '../nodes/StaticElement';
import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InColumnGroupComposer extends BaseComposer {
  inColumnGroup(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        this.insertDataNode(token as TextToken);
        break;
      case 'eof':
        return this.inBody(token);
      case 'startTag':
        return this.inColumnGroupStartTag(token as TagToken);
      case 'endTag':
        return this.inColumnGroupEndTag(token as TagToken);
      default:
        return this.inColumnGroupDefault(token);
    }
    return this.insertionMode;
  }

  inColumnGroupStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'col':
        this.createAndInsertEmptyElement(token);
        break;
      case 'template':
        return this.inHead(token);
      default:
        return this.inColumnGroupDefault(token);
    }
    return this.insertionMode;
  }

  inColumnGroupEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'colgroup':
        return this.inColumnGroupDefault(token, false);
      case 'col':
        this.error();
        break;
      case 'template':
        return this.inHead(token);
      default:
        return this.inColumnGroupDefault(token);
    }
    return this.insertionMode;
  }

  inColumnGroupDefault(token: Token, reprocess = true): InsertionMode {
    if ((this.current as StaticElement).tagName !== 'colgroup') {
      this.error();
      return this.insertionMode;
    } else {
      this.popCurrentElement();
      return reprocess ? this.reprocessIn('inTable', token) : 'inTable';
    }
  }
}