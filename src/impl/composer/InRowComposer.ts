import {StaticElement} from '../nodes/StaticElement';
import {TagToken, Token} from '../tokens';
import {InsertionMode} from './insertion-mode';
import {InTableComposer} from './InTableComposer';

export class InRowComposer extends InTableComposer {
  inRow(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inRowStartTag(token as TagToken);
      case 'endTag':
        return this.inRowEndTag(token as TagToken);
      default:
        return this.inTable(token);
    }
  }

  inRowStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'th':
      case 'td':
        this.clearStackToRowContext();
        this.createAndInsertElement(token);
        this.insertFormattingMarker();
        return 'inCell';
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
        return this.inRowEndRow(token, true);
      default:
        return this.inTable(token);
    }
  }

  inRowEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tr':
        return this.inRowEndRow(token, false);
      case 'table':
        return this.inRowEndRow(token, true);
      case 'tbody':
      case 'tfoot':
      case 'thead':
        if (!this.tableScopeCounts[token.name]) {
          this.error();
        } else if (this.tableScopeCounts['tr']) {
          this.clearStackToRowContext();
          this.popCurrentElement();
          return this.reprocessIn('inTableBody', token);
        }
        break;
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'td':
      case 'th':
        this.error();
        break;
      default:
        return this.inTable(token);
    }
    return this.insertionMode;
  }

  protected inRowEndRow(token: TagToken, reprocess: boolean) {
    if (this.tableScopeCounts['tr']) {
      this.clearStackToRowContext();
      this.popCurrentElement();
      return reprocess ? this.reprocessIn('inTableBody', token) : 'inTableBody';
    } else {
      this.error();
      return this.insertionMode;
    }
  }

  clearStackToRowContext() {
    this.popUntilMatches(this.notARowContext);
  }

  protected notARowContext(element: StaticElement, name: string): boolean {
    switch (name) {
      case 'tr':
      case 'template':
      case 'html':
        return false;
      default:
        return true;
    }
  }
}