import {CharactersToken, CommentToken, DoctypeToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class BeforeHeadComposer extends BaseComposer {
  initial(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        return 'initial';
      case 'doctype':
        this.insertDoctype(token as DoctypeToken);
        // TODO set doctype of current document
        return 'beforeHtml';
      default:
        //whitespace is ignored on tokenizer level
        this.error('missing-doctype');
        return this.reprocessIn('beforeHtml', token);
    }
  }

  beforeHtml(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
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
        this.insertComment(token as CommentToken);
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