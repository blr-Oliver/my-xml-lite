import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InFramesetComposer extends BaseComposer {
  inFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        // non-whitespace characters are filtered on tokenizer level
        this.insertCharacters(token as CharactersToken);
        break;
      case 'eof':
        if (this.openElements.length !== 1 || this.openElements[0].tagName !== 'html')
          this.error('abrupt-end-of-frameset');
        return this.stopParsing();
      case 'startTag':
        return this.inFramesetStartTag(token as TagToken);
      case 'endTag':
        return this.inFramesetEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  inFramesetStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'frameset':
        this.createAndInsertHTMLElement(token);
        break;
      case 'frame':
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'noframes':
        return this.inHead(token);
      default:
        this.error('unexpected-content-in-frameset');
    }
    return this.insertionMode;
  }

  inFramesetEndTag(token: TagToken): InsertionMode {
    if (token.name === 'frameset') {
      if (this.openElements.length === 1 && this.openElements[0].tagName === 'html') {
        this.error('orphan-end-tag');
      } else {
        this.popCurrentElement();
        if (!this.contextElement && this.current.tagName !== 'frameset')
          return 'afterFrameset';
      }
    } else
      this.error('unexpected-content-in-frameset');
    return this.insertionMode;
  }
}