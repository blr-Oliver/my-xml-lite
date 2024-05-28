import {TagToken, Token} from '../tokens';
import {InSelectComposer} from './InSelectComposer';
import {InsertionMode} from './insertion-mode';

export class InSelectInTableComposer extends InSelectComposer {
  inSelectInTable(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inSelectInTableStartTag(token as TagToken);
      case 'endTag':
        return this.inSelectInTableEndTag(token as TagToken);
      default:
        return this.inSelect(token);
    }
  }

  inSelectInTableStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
      case 'table':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
      case 'td':
      case 'th':
        this.error();
        this.popUntilMatches(name => name !== 'select');
        this.popCurrentElement();
        this.resetInsertionMode();
        return this.reprocessIn(this.insertionMode, token);
      default:
        return this.inSelect(token);
    }
  }

  inSelectInTableEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
      case 'table':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
      case 'td':
      case 'th':
        this.error();
        if (this.tableScopeCounts[token.name]) {
          this.popUntilMatches(name => name !== 'select');
          this.popCurrentElement();
          this.resetInsertionMode();
          return this.reprocessIn(this.insertionMode, token);
        } else
          return this.insertionMode;
      default:
        return this.inSelect(token);
    }
  }
}