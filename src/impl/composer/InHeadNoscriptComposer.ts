import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InHeadNoscriptComposer extends BaseComposer {
  inHeadNoscript(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inHeadNoscriptCharacters(token as CharactersToken);
      case 'startTag':
        return this.inHeadNoscriptStartTag(token as TagToken);
      case 'endTag':
        return this.inHeadNoscriptEndTag(token as TagToken);
      default:
        return this.escapeInHeadNoscript(token);
    }
    return this.insertionMode;
  }

  inHeadNoscriptStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
      case 'noframes':
      case 'style':
        return this.inHead(token);
      case 'head':
      case 'noscript':
        this.error('unexpected-start-tag-in-head-noscript');
        return this.insertionMode;
      default:
        return this.escapeInHeadNoscript(token);
    }
  }

  inHeadNoscriptEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'noscript':
        this.popCurrentElement();
        return 'inHead';
      case 'br':
        return this.escapeInHeadNoscript(token);
      default:
        this.error('unexpected-end-tag-in-head-noscript');
    }
    return this.insertionMode;
  }

  inHeadNoscriptCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.escapeInHeadNoscript(token);
  }

  escapeInHeadNoscript(token: Token): InsertionMode {
    this.error('inappropriate-content-in-head-noscript');
    this.popCurrentElement();
    return this.reprocessIn('inHead', token);
  }
}