import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InHeadNoscriptComposer extends BaseComposer {
  inHeadNoscript(token: Token): InsertionMode {
    let tagToken: TagToken;
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        return this.inHeadNoscriptCharacters(token as CharactersToken);
      case 'startTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'html':
            return this.inBody(token);
          case 'basefont':
          case 'bgsound':
          case 'link':
          case 'meta':
          case 'noframes':
          case 'style':
            return this.inHead(tagToken);
          case 'head':
          case 'noscript':
            this.error();
            break;
          default:
            return this.escapeInHeadNoscript(token);
        }
        break;
      case 'endTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'noscript':
            this.popCurrentElement();
            return 'inHead';
          case 'br':
            return this.escapeInHeadNoscript(token);
          default:
            this.error();
            break;
        }
        break;
      default:
        return this.escapeInHeadNoscript(token);
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
    this.error();
    this.popCurrentElement();
    return this.reprocessIn('inHead', token);
  }


}