import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class AfterAfterComposer extends BaseComposer {
  afterAfterBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        return this.inBody(token);
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterAfterBodyStartTag(token as TagToken);
      default:
        return this.afterAfterBodyDefault(token);
    }
    return this.insertionMode;
  }

  afterAfterBodyStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      default:
        return this.afterAfterBodyDefault(token);
    }
  }

  afterAfterBodyDefault(token: Token): InsertionMode {
    this.error();
    return this.reprocessIn('inBody', token);
  }

  afterAfterFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        return this.inBody(token);
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterAfterFramesetStartTag(token as TagToken);
      default:
        this.error();
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
        this.error();
    }
    return this.insertionMode;
  }
}