import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class AfterFramesetComposer extends BaseComposer {
  afterFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        this.insertCharacters(token as CharactersToken);
        break;
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterFramesetStartTag(token as TagToken);
      case 'endTag':
        return this.afterFramesetEndTag(token as TagToken);
      default:
        this.error();
    }
    return this.insertionMode;
  }

  afterFramesetStartTag(token: TagToken): InsertionMode {
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

  afterFramesetEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return 'afterAfterFrameset';
      default:
        this.error();
    }
    return this.insertionMode;
  }
}