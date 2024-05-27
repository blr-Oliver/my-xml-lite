import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
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
        this.createAndInsertElement(token);
        return 'inCaption';
      case 'colgroup':
        this.clearStackToTableContext();
        this.createAndInsertElement(token);
        return 'inColumnGroup';
      case 'col':
        this.clearStackToTableContext();
        return this.forceElementAndState('colgroup', 'inColumnGroup', token);
      case 'tbody':
      case 'tfoot':
      case 'thead':
        this.clearStackToTableContext();
        this.createAndInsertElement(token);
        return 'inTableBody';
      case 'td':
      case 'th':
      case 'tr':
        this.clearStackToTableContext();
        return this.forceElementAndState('tbody', 'inTableBody', token);
      case 'table':
        this.error();
        if (this.tableScopeCounts['table']) {
          this.popUntilMatches(name => name !== 'table');
          this.popCurrentElement();
          this.resetInsertionMode();
          return this.reprocessIn(this.insertionMode, token);
        }
        break;
      case 'style':
      case 'script':
      case 'template':
        return this.inHead(token); // TODO this actually should be inHeadStartTag
      case 'input':
        const inputElement = this.createElement(token);
        const type = inputElement.getAttribute('type');
        if (type === null || type.toLowerCase() !== 'hidden') {
          return this.escapeInTable(token);
        } else {
          this.error();
          this.insertEmptyElement(inputElement);
          // TODO acknowledge self-closing flag
        }
        break;
      case 'form':
        this.error();
        if (!this.openCounts['template'] && !this.formElement) {
          this.formElement = this.createAndInsertElement(token);
          this.popCurrentElement();
        }
    }
    return this.insertionMode;
  }

  inTableEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'table':
        if (this.tableScopeCounts['table']) {
          this.popUntilMatches(name => name !== 'table');
          this.popCurrentElement();
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

  protected notATableContext(name: string): boolean {
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