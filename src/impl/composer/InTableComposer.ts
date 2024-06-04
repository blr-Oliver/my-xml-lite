import {Element} from '../../decl/xml-lite-decl';
import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer, NS_HTML} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InTableComposer extends BaseComposer {
  pendingTableCharacters: TextToken[] = [];

  inTable(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        this.pendingTableCharacters.length = 0;
        this.originalInsertionMode = this.insertionMode;
        return this.reprocessIn('inTableText', token);
      case 'startTag':
        return this.inTableStartTag(token as TagToken);
      case 'endTag':
        return this.inTableEndTag(token as TagToken);
      case 'eof':
        return this.inBody(token);
      default:
        return this.escapeInTable(token);
    }
    return this.insertionMode;
  }

  inTableStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
        this.clearStackToTableContext();
        this.insertFormattingMarker();
        this.createAndInsertHTMLElement(token);
        return 'inCaption';
      case 'colgroup':
        this.clearStackToTableContext();
        this.createAndInsertHTMLElement(token);
        return 'inColumnGroup';
      case 'col':
        this.clearStackToTableContext();
        return this.forceElementAndState('colgroup', 'inColumnGroup', token);
      case 'tbody':
      case 'tfoot':
      case 'thead':
        this.clearStackToTableContext();
        this.createAndInsertHTMLElement(token);
        return 'inTableBody';
      case 'td':
      case 'th':
      case 'tr':
        this.clearStackToTableContext();
        return this.forceElementAndState('tbody', 'inTableBody', token);
      case 'table':
        this.error();
        if (this.hasElementInTableScope('table')) {
          this.popUntilName('table');
          this.resetInsertionMode();
          return this.reprocessIn(this.insertionMode, token);
        }
        break;
      case 'style':
      case 'script':
      case 'template':
        return this.inHead(token); // TODO this actually should be inHeadStartTag
      case 'input':
        const typeAttr = token.attributes.find(attr => attr.name === 'type');
        if (!typeAttr || (typeAttr.value || '').toLowerCase() !== 'hidden') {
          return this.escapeInTable(token);
        } else {
          this.error();
          this.createAndInsertEmptyHTMLElement(token);
        }
        break;
      case 'form':
        this.error();
        if (!this.openCounts['template'] && !this.formElement) {
          this.formElement = this.createAndInsertHTMLElement(token);
          this.popCurrentElement();
        }
    }
    return this.insertionMode;
  }

  inTableEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'table':
        if (this.hasElementInTableScope('table')) {
          this.popUntilName('table');
          this.resetInsertionMode();
        } else {
          this.error();
        }
        break;
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        this.error();
        break;
      case 'template':
        return this.inHead(token); // TODO this actually should be inHeadEndTag
    }
    return this.insertionMode;
  }

  clearStackToTableContext() {
    this.popUntilMatches(this.notATableContext);
  }

  protected notATableContext(name: string, element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return true;
    switch (name) {
      case 'table':
      case 'template':
      case 'html':
        return false;
      default:
        return true;
    }
  }

  escapeInTable(token: Token): InsertionMode {
    this.error();
    this.fosterParentingEnabled = true;
    let result = this.inBody(token);
    this.fosterParentingEnabled = false;
    return result;
  }
}