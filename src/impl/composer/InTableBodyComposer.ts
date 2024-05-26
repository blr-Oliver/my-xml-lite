import {StaticElement} from '../nodes/StaticElement';
import {TagToken, Token} from '../tokens';
import {InsertionMode} from './insertion-mode';
import {InTableComposer} from './InTableComposer';

export class InTableBodyComposer extends InTableComposer {
  inTableBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inTableBodyStartTag(token as TagToken);
      case 'endTag':
        return this.inTableBodyEndTag(token as TagToken);
      default:
        return this.inTable(token);
    }
  }

  inTableBodyStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tr':
        this.clearStackToTBodyContext();
        this.createAndInsertElement(token);
        return 'inRow';
      case 'th':
      case 'td':
        this.error();
        this.clearStackToTBodyContext();
        return this.forceElementAndState('tr', 'inRow', token);
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
        return this.inTableBodyEndTable(token);
      default:
        return this.inTable(token);
    }
  }

  inTableBodyEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tbody':
      case 'tfoot':
      case 'thead':
        if (this.tableScopeCounts[token.name]) {
          this.clearStackToTBodyContext();
          this.popCurrentElement();
          return 'inTable';
        } else {
          this.error();
          break;
        }
      case 'table':
        return this.inTableBodyEndTable(token);
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'td':
      case 'th':
      case 'tr':
        this.error();
        break;
      default:
        return this.inTable(token);
    }
    return this.insertionMode;
  }

  protected inTableBodyEndTable(token: TagToken) {
    if (this.tableScopeCounts['tbody'] || this.tableScopeCounts['thead'] || this.tableScopeCounts['tfoot']) {
      this.clearStackToTBodyContext();
      this.popCurrentElement();
      return this.reprocessIn('inTable', token);
    } else {
      this.error();
      return this.insertionMode;
    }
  }

  clearStackToTBodyContext() {
    this.popUntilMatches(this.notATBodyContext);
  }

  protected notATBodyContext(element: StaticElement, name: string): boolean {
    switch (name) {
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'template':
      case 'html':
        return false;
      default:
        return true;
    }
  }
}