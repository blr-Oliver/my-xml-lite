import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class HeadComposer extends BaseComposer {
  inHead(token: Token): InsertionMode {
    let tagToken = token as TagToken;
    switch (token.type) {
      case 'characters':
        // TODO separate whitespace and text
        this.insertDataNode(token as TextToken);
        break;
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'startTag':
        return this.inHeadStartTag(token as TagToken);
      case 'endTag':
        return this.inHeadEndTag(token as TagToken);
      default:
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
    }
    return this.insertionMode;
  }

  inHeadStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
        this.createAndAddEmptyElement(token);
        break;
      case 'title':
        return this.startTextMode('rcdata', token);
      case 'noscript':
      case 'noframes':
      case 'style':
        return this.startTextMode('rawtext', token);
      case 'script':
        return this.startTextMode('scriptData', token);
      case 'template':
        return this.startTemplate(token);
      case 'head':
        this.error();
        break;
      default:
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
    }
    return this.insertionMode;
  }

  inHeadEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.popCurrentElement();
        return 'afterHead';
      case 'template':
        if (this.openCounts['template'])
          return this.endTemplate(token);
        this.error();
        break;
      case 'body':
      case 'html':
      case 'br':
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
      default:
        this.error();
    }
    return this.insertionMode;
  }

  inHeadNoscript(token: Token): InsertionMode {
    let tagToken: TagToken;
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        this.insertDataNode(token as TextToken);
        break;
      case 'startTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'html':
            return this.inBody(token);
          case 'basefont':
          case 'bgsound':
          case 'link':
          case 'meta':
          case 'noframes':
          case 'style':
            return this.inHeadStartTag(tagToken);
          case 'head':
          case 'noscript':
            this.error();
            break;
          default:
            return this.escapeInHeadNoscript(token);
        }
        break;
      case 'endTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'noscript':
            this.popCurrentElement();
            return 'inHead';
          case 'br':
            return this.escapeInHeadNoscript(token);
          default:
            this.error();
            break;
        }
        break;
      default:
        return this.escapeInHeadNoscript(token);
    }
    return this.insertionMode;
  }

  escapeInHeadNoscript(token: Token): InsertionMode {
    this.error();
    this.popCurrentElement();
    return this.reprocessIn('inHead', token);
  }

  afterHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        this.insertDataNode(token as TextToken);
        break;
      case 'startTag':
        return this.afterHeadStartTag(token as TagToken);
      case 'endTag':
        return this.afterHeadEndTag(token as TagToken);
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  afterHeadStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.error();
        break;
      case 'html':
        return this.inBody(token);
      case 'body':
        this.createAndPushElement(token);
        // TODO frameset-ok flag
        return 'inBody';
      case 'frameset':
        this.createAndPushElement(token);
        return 'inFrameset';
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
        this.error();
        this.openElements.push(this.current = this.headElement);
        this.openCounts['head'] = (this.openCounts['head'] || 0) + 1;
        let result = this.inHead(token);
        let index = this.openElements.indexOf(this.headElement);
        if (index === this.openElements.length - 1)
          this.popCurrentElement();
        else {
          this.openElements.splice(index, 1);
          this.openCounts['head']--;
        }
        return result;
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  afterHeadEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        return this.inHeadEndTag(token);
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('body', 'inBody', token);
      default:
        this.error();
        return this.insertionMode;
    }
  }
}