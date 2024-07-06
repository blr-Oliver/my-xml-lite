import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class AfterHeadComposer extends BaseComposer {
  afterHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.afterHeadCharacters(token as CharactersToken);
      case 'startTag':
        return this.afterHeadStartTag(token as TagToken);
      case 'endTag':
        return this.afterHeadEndTag(token as TagToken);
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  afterHeadCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.forceElementAndState('body', 'inBody', token);
  }

  afterHeadStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.error('unexpected-start-tag');
        break;
      case 'html':
        return this.inBody(token);
      case 'body':
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        return 'inBody';
      case 'frameset':
        this.createAndInsertHTMLElement(token);
        return 'inFrameset';
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
      case 'noframes':
      case 'script':
      case 'style':
      case 'template':
      case 'title':
        this.error('head-content-after-head');
        this.pushOpenElement(this.headElement!);
        let result = this.inHead(token);
        let index = this.openElements.indexOf(this.headElement!);
        if (index === this.openElements.length - 1)
          this.popCurrentElement();
        else {
          this.openElements.splice(index, 1);
          // pushing directly and popping ensures every side-effect of removing top element
          this.openElements.push(this.headElement!);
          this.popCurrentElement();
        }
        return result;
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  afterHeadEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        // is there any well-formed case for this?
        // if no, should just shortcut to error('orphan-end-tag')
        return this.endTemplate();
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('body', 'inBody', token);
      default:
        this.error('unexpected-end-tag-after-head');
        return this.insertionMode;
    }
  }
}