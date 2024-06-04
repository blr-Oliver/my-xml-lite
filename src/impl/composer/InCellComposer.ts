import {Element} from '../../decl/xml-lite-decl';
import {TagToken, Token} from '../tokens';
import {BaseComposer, NS_HTML} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InCellComposer extends BaseComposer {
  inCell(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inCellStartTag(token as TagToken);
      case 'endTag':
        return this.inCellEndTag(token as TagToken);
      default:
        return this.inBody(token);
    }
  }

  inCellStartTag(token: TagToken): InsertionMode {
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
        return this.closeTheCell(token);
      default:
        return this.inBody(token);
    }
  }

  inCellEndTag(token: TagToken): InsertionMode {
    const tagName = token.name;
    switch (tagName) {
      case 'td':
      case 'th':
        if (this.hasElementInTableScope(tagName)) {
          this.generateImpliedEndTags();
          if (this.current.tagName !== tagName) {
            this.error();
            this.popUntilName(tagName);
          } else
            this.popCurrentElement();
          this.clearFormattingUpToMarker();
          return 'inRow';
        } else
          this.error();
        break;
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
        this.error();
        break;
      case 'table':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
        if (this.hasElementInTableScope(tagName))
          return this.closeTheCell(token);
        this.error();
        break;
      default:
        return this.inBody(token);
    }
    return this.insertionMode;
  }

  closeTheCell(token: Token): InsertionMode {
    this.generateImpliedEndTags();
    const currentTagName = (this.current as Element).tagName;
    if (currentTagName !== 'td' && currentTagName !== 'th') {
      this.error();
      this.popUntilMatches((name, el) => name !== 'td' && name !== 'th' || el.namespaceURI !== NS_HTML);
    }
    this.popCurrentElement();
    this.clearFormattingUpToMarker();
    return this.reprocessIn('inRow', token);
  }
}