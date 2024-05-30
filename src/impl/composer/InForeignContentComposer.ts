import {Element} from '../../decl/xml-lite-decl';
import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InForeignContentComposer extends BaseComposer {
  inForeignContent(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO replace NUL at tokenizer level
        this.insertDataNode(token as TextToken);
        break;
      case 'startTag':
        return this.inForeignContentStartTag(token as TagToken);
      case 'endTag':
        return this.inForeignContentEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  inForeignContentStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'font':
        if (token.attributes.every(attr => attr.name !== 'color' && attr.name !== 'face' && attr.name !== 'size'))
          return this.inForeignContentStartTagDefault(token);
      case 'b':
      case 'big':
      case 'blockquote':
      case 'body':
      case 'br':
      case 'center':
      case 'code':
      case 'dd':
      case 'div':
      case 'dl':
      case 'dt':
      case 'em':
      case 'embed':
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
      case 'head':
      case 'hr':
      case 'i':
      case 'img':
      case 'li':
      case 'listing':
      case 'menu':
      case 'meta':
      case 'nobr':
      case 'ol':
      case 'p':
      case 'pre':
      case 'ruby':
      case 's':
      case 'small':
      case 'span':
      case 'strong':
      case 'strike':
      case 'sub':
      case 'sup':
      case 'table':
      case 'tt':
      case 'u':
      case 'ul':
      case 'var':
        this.error();
        this.popUntilMatches(this.isForeignNonIntegrationPoint);
        return this.reprocessIn(this.insertionMode, token);
      default:
        return this.inForeignContentStartTagDefault(token);
    }
  }

  inForeignContentStartTagDefault(token: TagToken): InsertionMode {
    return this.insertionMode;
  }

  inForeignContentEndTag(token: TagToken): InsertionMode {
    return this.insertionMode;
  }

  isForeignNonIntegrationPoint(name: string, element: Element): boolean {
    const namespace = (element as any)['namespace']; // TODO introduce namespaces
    switch (namespace) {
      case 'html':
        return false;
      case 'math':
        switch (name) {
          case 'annotation-xml':
            const encoding = (element.getAttribute('encoding') || '').toLowerCase();
            return encoding !== 'text/html' && encoding !== 'application/xhtml+xml';
          case 'mi':
          case 'mo':
          case 'mn':
          case 'ms':
          case 'mtext':
            return false;
          default:
            return true;
        }
      case 'svg':
        switch (name) {
          case 'foreignObject':
          case 'foreignobject': // TODO this should probably not repeat
          case 'desc':
          case 'title':
            return false;
          default:
            return true;
        }
      default:
        return true;
    }
  }
}