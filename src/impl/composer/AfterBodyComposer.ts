import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class AfterBodyComposer extends BaseComposer {
  afterBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken, this.openElements[0]);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.afterBodyCharacters(token as CharactersToken);
      case 'startTag':
        return this.afterBodyStartTag(token as TagToken);
      case 'endTag':
        return this.afterBodyEndTag(token as TagToken);
      case 'eof':
        return this.stopParsing();
    }
    return this.insertionMode;
  }

  afterBodyCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly)
      return this.inBody(token);
    return this.afterBodyDefault(token);
  }

  afterBodyStartTag(token: TagToken): InsertionMode {
    if (token.name === 'html')
      return this.inBody(token);
    return this.afterBodyDefault(token);
  }

  afterBodyEndTag(token: TagToken): InsertionMode {
    if (token.name === 'html') {
      if (this.contextElement) {
        this.error('unexpected-end-tag');
        return this.insertionMode;
      }
      return 'afterAfterBody';
    }
    return this.afterBodyDefault(token);
  }

  afterBodyDefault(token: Token): InsertionMode {
    this.error('content-after-body');
    return this.reprocessIn('inBody', token);
  }
}