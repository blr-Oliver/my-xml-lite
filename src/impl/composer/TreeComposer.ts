import {DoctypeToken, TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class TreeComposer extends BaseComposer {
  initial(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        return 'initial';
      case 'doctype':
        this.insertDoctype(token as DoctypeToken);
        return 'beforeHtml';
      default:
        //TODO in this state whitespace should be ignored at tokenizer level
        return this.beforeHtml(token);
    }
  }

  beforeHtml(token: Token): InsertionMode {
    let tagToken: TagToken;
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        return 'beforeHtml';
      case 'doctype':
        this.error();
        return 'beforeHtml';
      case 'startTag':
        tagToken = token as TagToken;
        if (tagToken.name === 'html') {
          this.createAndPushElement(tagToken);
          return 'beforeHead';
        }
        return this.forceElementAndState('html', 'beforeHead', token);
      case 'endTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'head':
          case 'body':
          case 'html':
          case 'br':
            return this.forceElementAndState('html', 'beforeHead', token);
          default:
            this.error();
            return 'beforeHtml';
        }
      default:
        return this.forceElementAndState('html', 'beforeHead', token);
    }
  }

  beforeHead(token: Token): InsertionMode {
    let tagToken = token as TagToken;
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'startTag':
        switch (tagToken.name) {
          case 'html':
            return this.inBody(token);
          case 'head':
            this.headElement = this.createAndPushElement(tagToken);
            return 'inHead';
          default:
            return this.forceHead(token);
        }
      case 'endTag':
        switch (tagToken.name) {
          case 'head':
          case 'body':
          case 'html':
          case 'br':
            return this.forceHead(token);
          default:
            this.error();
        }
    }
    return this.insertionMode;
  }

  forceHead(token: Token): InsertionMode {
    this.headElement = this.createAndPushElement({
      type: 'startTag',
      name: 'head',
      selfClosing: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn('inHead', token);
  }

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
        return this.startTagInHead(token as TagToken);
      case 'endTag':
        return this.endTagInHead(token as TagToken);
      default:
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
    }
    return this.insertionMode;
  }

  startTagInHead(token: TagToken): InsertionMode {
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

  endTagInHead(token: TagToken): InsertionMode {
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
            return this.startTagInHead(tagToken);
          case 'head':
          case 'noscript':
            this.error();
            break;
          default:
            return this.escapeNoscript(token);
        }
        break;
      case 'endTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'noscript':
            this.popCurrentElement();
            return 'inHead';
          case 'br':
            return this.escapeNoscript(token);
          default:
            this.error();
            break;
        }
        break;
      default:
        return this.escapeNoscript(token);
    }
    return this.insertionMode;
  }

  escapeNoscript(token: Token): InsertionMode {
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
        return this.startTagAfterHead(token as TagToken);
      case 'endTag':
        return this.endTagAfterHead(token as TagToken);
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  startTagAfterHead(token: TagToken): InsertionMode {
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

  endTagAfterHead(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        return this.endTagInHead(token);
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('body', 'inBody', token);
      default:
        this.error();
        return this.insertionMode;
    }
  }

  inBody(token: Token): InsertionMode {
    return this.insertionMode;
  }
}