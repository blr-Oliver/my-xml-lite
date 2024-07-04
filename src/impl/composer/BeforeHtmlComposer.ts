import {CommentToken, TagToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class BeforeHtmlComposer extends BaseComposer {
  beforeHtml(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        return 'beforeHtml';
      case 'doctype':
        this.error('unexpected-doctype');
        return 'beforeHtml';
      case 'startTag':
        return this.beforeHtmlStartTag(token as TagToken);
      case 'endTag':
        return this.beforeHtmlEndTag(token as TagToken);
      default:
        //whitespace is ignored on tokenizer level
        return this.forceElementAndState('html', 'beforeHead', token);
    }
  }

  beforeHtmlStartTag(token: TagToken) {
    if (token.name === 'html') {
      this.createAndInsertHTMLElement(token);
      return 'beforeHead';
    }
    return this.forceElementAndState('html', 'beforeHead', token);
  }

  beforeHtmlEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('html', 'beforeHead', token);
      default:
        this.error('unexpected-tag-before-html');
        return 'beforeHtml';
    }
  }
}