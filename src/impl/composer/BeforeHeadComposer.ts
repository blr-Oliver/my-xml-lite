import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class BeforeHeadComposer extends BaseComposer {
  beforeHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
        return this.beforeHeadCharacters(token as CharactersToken);
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'startTag':
        return this.beforeHeadStartTag(token as TagToken);
      case 'endTag':
        return this.beforeHeadEndTag(token as TagToken);
      default:
        return this.forceHead(token);
    }
    return this.insertionMode;
  }

  beforeHeadCharacters(token: CharactersToken): InsertionMode {
    if (!token.whitespaceOnly)
      return this.forceHead(token);
    return this.insertionMode;
  }

  beforeHeadStartTag(token: TagToken) {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'head':
        this.headElement = this.createAndInsertHTMLElement(token);
        return 'inHead';
      default:
        return this.forceHead(token);
    }
  }

  beforeHeadEndTag(tagToken: TagToken): InsertionMode {
    switch (tagToken.name) {
      case 'head':
      case 'body':
      case 'html':
      case 'br':
        return this.forceHead(tagToken);
      default:
        this.error('unexpected-tag-before-head');
    }
    return this.insertionMode;
  }

  protected forceHead(token: Token): InsertionMode {
    this.headElement = this.createAndInsertHTMLElement({
      type: 'startTag',
      name: 'head',
      selfClosed: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn('inHead', token);
  }

}