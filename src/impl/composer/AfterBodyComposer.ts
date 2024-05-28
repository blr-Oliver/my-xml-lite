import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class AfterBodyComposer extends BaseComposer {
  afterBody(token: Token): InsertionMode {
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
      case 'startTag':
        return this.afterBodyStartTag(token as TagToken);
      case 'endTag':
        return this.afterBodyEndTag(token as TagToken);
      case 'eof':
        return this.stopParsing();
      default:
        return this.afterBodyDefault(token);
    }
    return this.insertionMode;
  }

  afterBodyStartTag(token: TagToken): InsertionMode {
    if (token.name === 'html')
      return this.inBody(token);
    return this.afterBodyDefault(token);
  }

  afterBodyEndTag(token: TagToken): InsertionMode {
    if (token.name === 'html') {
      if (this.isFragmentParser) { // TODO check fragment parsing case
        this.error();
        return this.insertionMode;
      }
      return 'afterAfterBody';
    }
    return this.afterBodyDefault(token);
  }

  afterBodyDefault(token: Token): InsertionMode {
    this.error();
    return this.reprocessIn('inBody', token);
  }
}