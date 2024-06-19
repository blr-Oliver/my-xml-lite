import {Element} from '../../decl/xml-lite-decl';
import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer, NS_HTML} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InTableComposer extends BaseComposer {
  pendingTableCharacters: CharactersToken[] = [];

  inTable(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
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
        return this.inTableDefault(token);
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
        this.error('table-in-table');
        if (this.hasElementInTableScope('table')) {
          this.popUntilName('table');
          this.resetInsertionMode();
          return this.process(token);
        }
        break;
      case 'style':
      case 'script':
      case 'template':
        return this.inHead(token);
      case 'input':
        const typeAttr = token.attributes.find(attr => attr.name === 'type');
        if (!typeAttr || (typeAttr.value || '').toLowerCase() !== 'hidden') {
          return this.inTableDefault(token);
        } else {
          this.error('hidden-input-in-table');
          this.createAndInsertEmptyHTMLElement(token);
        }
        break;
      case 'form':
        this.error('form-in-table');
        if (!this.openCounts['template'] && !this.formElement) {
          this.formElement = this.createAndInsertHTMLElement(token);
          this.popCurrentElement();
        }
        break;
      default:
        this.inTableDefault(token);
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
        this.error('unexpected-end-tag-in-table');
        break;
      case 'template':
        return this.inHead(token);
      default:
        return this.inTableDefault(token);
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

  inTableDefault(token: Token): InsertionMode {
    if (token.type !== 'characters' && token.type !== 'cdata')
      this.error('unexpected-content-in-table');
    this.fosterParentingEnabled = true;
    const result = this.inBody(token);
    this.fosterParentingEnabled = false;
    return result;
  }

  inTableText(token: Token) {
    if (token.type === 'characters') {
      this.pendingTableCharacters.push(token as CharactersToken);
      return this.insertionMode;
    } else {
      const text = this.mergePendingCharacters();
      if (text.whitespaceOnly)
        this.insertCharacters(text);
      else {
        this.error('text-in-table');
        this.inTableDefault(text);
      }
      return this.reprocessIn(this.originalInsertionMode, token);
    }
  }

  protected mergePendingCharacters(): CharactersToken {
    const len = this.pendingTableCharacters.length;
    if (len === 1)
      return this.pendingTableCharacters[0];
    else {
      let chunks = Array(len);
      let whitespaceOnly = true;
      for (let i = 0; i < len; ++i) {
        const textToken = this.pendingTableCharacters[i];
        chunks[i] = textToken.data;
        whitespaceOnly &&= textToken.whitespaceOnly;
      }
      return {
        type: 'characters',
        data: chunks.join(''),
        whitespaceOnly
      };
    }
  }
}