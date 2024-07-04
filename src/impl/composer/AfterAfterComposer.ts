import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class AfterAfterComposer extends BaseComposer {
  afterAfterBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken, this.document);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.afterAfterBodyCharacters(token as CharactersToken);
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterAfterBodyStartTag(token as TagToken);
      default:
        return this.afterAfterBodyDefault(token);
    }
    return this.insertionMode;
  }

  private afterAfterBodyCharacters(token: CharactersToken) {
    if (token.whitespaceOnly)
      return this.inBody(token);
    return this.afterAfterBodyDefault(token);
  }

  afterAfterBodyStartTag(token: TagToken): InsertionMode {
    if (token.name === 'html')
      return this.inBody(token);
    return this.afterAfterBodyDefault(token);
  }

  afterAfterBodyDefault(token: Token): InsertionMode {
    this.error('content-after-html');
    return this.reprocessIn('inBody', token);
  }

  afterAfterFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken, this.document);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inBody(token);
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterAfterFramesetStartTag(token as TagToken);
      default:
        this.error('content-after-html');
    }
    return this.insertionMode;
  }

  afterAfterFramesetStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'noframes':
        return this.inHead(token);
      default:
        this.error('content-after-html');
    }
    return this.insertionMode;
  }
}