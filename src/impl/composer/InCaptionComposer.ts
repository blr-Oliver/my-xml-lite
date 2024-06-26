import {TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InCaptionComposer extends BaseComposer {
  inCaption(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inCaptionStartTag(token as TagToken);
      case 'endTag':
        return this.inCaptionEndTag(token as TagToken);
      default:
        return this.inCaptionDefault(token);
    }
  }

  inCaptionStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        return this.inCaptionEnd(token, true);
      default:
        return this.inCaptionDefault(token);
    }
  }

  inCaptionEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
        return this.inCaptionEnd(token, false);
      case 'table':
        return this.inCaptionEnd(token, true);
      case 'body':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        this.error('unexpected-end-tag-in-caption');
        break;
      default:
        return this.inCaptionDefault(token);
    }
    return this.insertionMode;
  }

  inCaptionDefault(token: Token): InsertionMode {
    return this.inBody(token);
  }

  inCaptionEnd(token: TagToken, reprocess: boolean): InsertionMode {
    if (this.hasElementInTableScope('caption')) {
      this.generateImpliedEndTags();
      if (this.current.tagName !== 'caption') {
        this.error();
        this.popUntilName('caption');
      } else
        this.popCurrentElement();
      this.clearFormattingUpToMarker();
      return reprocess ? this.reprocessIn('inTable', token) : 'inTable';
    } else
      this.error();
    return this.insertionMode;
  }
}