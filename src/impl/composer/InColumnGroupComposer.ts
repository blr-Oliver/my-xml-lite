import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InColumnGroupComposer extends BaseComposer {
  inColumnGroup(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inColumnGroupCharacters(token as CharactersToken);
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

  inColumnGroupCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.inColumnGroupDefault(token);
  }

  inColumnGroupStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'col':
        this.createAndInsertEmptyHTMLElement(token);
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
        this.error('void-html-element-end-tag');
        break;
      case 'template':
        return this.inHead(token);
      default:
        return this.inColumnGroupDefault(token);
    }
    return this.insertionMode;
  }

  inColumnGroupDefault(token: Token, reprocess = true): InsertionMode {
    if (this.current.tagName !== 'colgroup') {
      this.error('unexpected-content-in-column-group');
      return this.insertionMode;
    } else {
      this.popCurrentElement();
      return reprocess ? this.reprocessIn('inTable', token) : 'inTable';
    }
  }
}