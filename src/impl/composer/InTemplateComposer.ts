import {TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InTemplateComposer extends BaseComposer {
  inTemplate(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
      case 'comment':
      case 'doctype':
        return this.inBody(token);
      case 'eof':
        if (this.openCounts['template']) {
          this.error();
          this.popUntilMatches(name => name !== 'template');
          this.popCurrentElement();
          this.clearFormattingUpToMarker();
          this.templateInsertionModes.pop();
          this.resetInsertionMode();
          return this.reprocessIn(this.insertionMode, token);
        } else
          return this.stopParsing();
      case 'startTag':
        return this.inTemplateStartTag(token as TagToken);
      case 'endTag':
        return this.inTemplateEndTag(token as TagToken);
      default:
        this.error();
        break;
    }
    return this.insertionMode;
  }

  inTemplateStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
      case 'noframes':
      case 'script':
      case 'style':
      case 'template':
      case 'title':
        return this.inHead(token);
      case 'caption':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
        return this.updateTemplateModeAndReprocess('inTable', token);
      case 'col':
        return this.updateTemplateModeAndReprocess('inColumnGroup', token);
      case 'tr':
        return this.updateTemplateModeAndReprocess('inTableBody', token);
      case 'td':
      case 'th':
        return this.updateTemplateModeAndReprocess('inRow', token);
      default:
        return this.updateTemplateModeAndReprocess('inBody', token);
    }
  }

  inTemplateEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        return this.inHead(token);
      default:
        this.error();
        return this.insertionMode;
    }
  }

  protected updateTemplateModeAndReprocess(mode: InsertionMode, token: Token): InsertionMode {
    this.templateInsertionModes.pop();
    this.templateInsertionModes.push(mode);
    return this.reprocessIn(mode, token);
  }
}