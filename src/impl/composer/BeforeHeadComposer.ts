import {StaticElement} from '../nodes/StaticElement';
import {DoctypeToken, TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class BeforeHeadComposer extends BaseComposer {
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
        return this.reprocessIn('beforeHtml', token);
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
          this.createAndInsertElement(tagToken);
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
            this.headElement = this.createAndInsertElement(tagToken);
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
    this.headElement = this.createAndInsertElement({
      type: 'startTag',
      name: 'head',
      selfClosing: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn('inHead', token);
  }

}