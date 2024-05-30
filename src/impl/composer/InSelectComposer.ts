import {Element} from '../../decl/xml-lite-decl';
import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InSelectComposer extends BaseComposer {
  inSelect(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO exclude NUL characters on tokenizer level
        this.insertDataNode(token as TextToken);
        break;
      case 'startTag':
        return this.inSelectStartTag(token as TagToken);
      case 'endTag':
        return this.inSelectEndTag(token as TagToken);
      case 'eof':
        return this.inBody(token);
      default:
        this.error();
    }
    return this.insertionMode;
  }

  inSelectStartTag(token: TagToken): InsertionMode {
    const currentName = (this.current as Element).tagName;
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'option':
        if (currentName === 'option') this.popCurrentElement();
        this.createAndInsertElement(token);
        break;
      case 'optgroup':
        if (currentName === 'option') this.popCurrentElement();
        if (currentName === 'optgroup') this.popCurrentElement();
        this.createAndInsertElement(token);
        break;
      case 'hr':
        if (currentName === 'option') this.popCurrentElement();
        if (currentName === 'optgroup') this.popCurrentElement();
        this.createAndInsertEmptyElement(token);
        break;
      case 'select':
        this.error();
        return this.closeSelect(token, false, false);
      case 'input':
      case 'keygen':
      case 'textarea':
        this.error();
        return this.closeSelect(token, true, false);
      case 'script':
      case 'template':
        return this.inHead(token);
      default:
        this.error();
    }
    return this.insertionMode;
  }

  inSelectEndTag(token: TagToken): InsertionMode {
    const currentName = (this.current as Element).tagName;
    switch (token.name) {
      case 'optgroup':
        if (currentName === 'option') {
          const previous = this.openElements.at(-2) as Element;
          if (previous && previous.tagName === 'optgroup') {
            this.popCurrentElement();
            this.popCurrentElement();
          }
        } else if (currentName === 'optgroup')
          this.popCurrentElement();
        else
          this.error();
        break;
      case 'option':
        if (currentName === 'option')
          this.popCurrentElement();
        else
          this.error();
        break;
      case 'select':
        return this.closeSelect(token, false, true);
      case 'template':
        return this.inHead(token);
      default:
        this.error();
    }
    return this.insertionMode;
  }

  protected closeSelect(token: TagToken, reprocess: boolean, errorIfMissing: boolean) {
    if (this.hasElementInSelectScope('select')) {
      this.popUntilMatches(name => name !== 'select');
      this.popCurrentElement();
      this.resetInsertionMode();
      if (reprocess)
        return this.reprocessIn(this.insertionMode, token);
    } else if (errorIfMissing)
      this.error();
    return this.insertionMode;
  }
}