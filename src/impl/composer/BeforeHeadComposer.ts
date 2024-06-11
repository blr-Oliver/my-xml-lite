import {CharactersToken, DoctypeToken, TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class BeforeHeadComposer extends BaseComposer {
  initial(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
        if (!(token as CharactersToken).whitespaceOnly)
          return this.reprocessIn('beforeHtml', token);
        return this.insertionMode;
      case 'comment':
        this.insertDataNode(token as TextToken);
        return 'initial';
      case 'doctype':
        this.insertDoctype(token as DoctypeToken);
        return 'beforeHtml';
      default:
        return this.reprocessIn('beforeHtml', token);
    }
  }

  beforeHtml(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        return 'beforeHtml';
      case 'doctype':
        this.error();
        return 'beforeHtml';
      case 'startTag':
        const tagToken = token as TagToken;
        if (tagToken.name === 'html') {
          this.createAndInsertHTMLElement(tagToken);
          return 'beforeHead';
        }
        return this.forceElementAndState('html', 'beforeHead', token);
      case 'endTag':
        return this.beforeHtmlEndTag(token as TagToken);
      default:
        return this.forceElementAndState('html', 'beforeHead', token);
    }
  }

  beforeHtmlEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('html', 'beforeHead', token);
      default:
        this.error();
        return 'beforeHtml';
    }
  }

  beforeHead(token: Token): InsertionMode {
    let tagToken = token as TagToken;
    switch (token.type) {
      case 'characters':
        if (!(token as CharactersToken).whitespaceOnly)
          return this.forceHead(token);
        break;
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
            this.headElement = this.createAndInsertHTMLElement(tagToken);
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
        break;
      default:
        return this.forceHead(token)
    }
    return this.insertionMode;
  }

  forceHead(token: Token): InsertionMode {
    this.headElement = this.createAndInsertHTMLElement({
      type: 'startTag',
      name: 'head',
      selfClosed: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn('inHead', token);
  }

}