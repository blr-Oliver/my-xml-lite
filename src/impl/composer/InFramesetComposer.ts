import {Element} from '../../decl/xml-lite-decl';
import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InFramesetComposer extends BaseComposer {
  inFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        this.insertDataNode(token as TextToken);
        break;
      case 'eof':
        if (this.openElements.length !== 1 || this.openElements[0].tagName !== 'html')
          this.error();
        return this.stopParsing();
      case 'startTag':
        return this.inFramesetStartTag(token as TagToken);
      case 'endTag':
        return this.inFramesetEndTag(token as TagToken);
      default:
        this.error();
    }
    return this.insertionMode;
  }

  inFramesetStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'frameset':
        this.createAndInsertElement(token);
        break;
      case 'frame':
        this.createAndInsertEmptyElement(token);
        break;
      case 'noframes':
        return this.inHead(token);
      default:
        this.error();
    }
    return this.insertionMode;
  }

  inFramesetEndTag(token: TagToken): InsertionMode {
    if (token.name === 'frameset') {
      if (this.openElements.length === 1 && this.openElements[0].tagName === 'html') {
        this.error();
      } else {
        this.popCurrentElement();
        if (!this.isFragmentParser && (this.current as Element).tagName !== 'frameset')
          return 'afterFrameset';
      }
    } else
      this.error();
    return this.insertionMode;
  }
}