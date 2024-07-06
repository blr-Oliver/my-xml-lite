import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InHeadComposer extends BaseComposer {
  inHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
        return this.inHeadCharacters(token as CharactersToken);
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'startTag':
        return this.inHeadStartTag(token as TagToken);
      case 'endTag':
        return this.inHeadEndTag(token as TagToken);
      default:
        return this.inHeadDefault(token);
    }
    return this.insertionMode;
  }

  inHeadCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.inHeadDefault(token);
  }

  inHeadStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'title':
        return this.startTextMode('rcdata', token);
      case 'noscript':
      case 'noframes':
      case 'style':
        return this.startTextMode('rawtext', token);
      case 'script':
        return this.startTextMode('scriptData', token);
      case 'template':
        return this.startTemplate(token);
      case 'head':
        this.error('unexpected-start-tag-in-head');
        break;
      default:
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
    }
    return this.insertionMode;
  }

  inHeadEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.popCurrentElement();
        return 'afterHead';
      case 'template':
        return this.endTemplate();
      case 'body':
      case 'html':
      case 'br':
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
      default:
        this.error('unexpected-end-tag-in-head');
    }
    return this.insertionMode;
  }

  inHeadDefault(token: Token): InsertionMode {
    this.popCurrentElement();
    return this.reprocessIn('afterHead', token);
  }
}