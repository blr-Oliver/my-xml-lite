import {Element} from '../../decl/xml-lite-decl';
import {TagToken, Token} from '../tokens';
import {NS_HTML} from './BaseComposer';
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
        this.createAndInsertHTMLElement(token);
        return 'inRow';
      case 'th':
      case 'td':
        this.error('table-cell-in-table-body');
        this.clearStackToTBodyContext();
        return this.forceElementAndState('tr', 'inRow', token);
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
        return this.inTableBodyEndTableBody(token);
      default:
        return this.inTable(token);
    }
  }

  inTableBodyEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tbody':
      case 'tfoot':
      case 'thead':
        if (this.hasElementInTableScope(token.name)) {
          this.clearStackToTBodyContext();
          this.popCurrentElement();
          return 'inTable';
        } else {
          this.error('unexpected-end-tag-in-table-body');
          break;
        }
      case 'table':
        return this.inTableBodyEndTableBody(token);
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'td':
      case 'th':
      case 'tr':
        this.error('unexpected-end-tag-in-table-body');
        break;
      default:
        return this.inTable(token);
    }
    return this.insertionMode;
  }

  protected inTableBodyEndTableBody(token: TagToken) {
    if (this.hasMatchInScope(el => this.isTableBodyElement(el), el => this.isTableScopeFence(el))) {
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

  protected notATBodyContext(name: string, element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return true;
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

  protected isTableBodyElement(element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return false;
    switch (element.tagName) {
      case 'tbody':
      case 'thead':
      case 'tfoot':
        return true;
      default:
        return false;
    }
  }
}