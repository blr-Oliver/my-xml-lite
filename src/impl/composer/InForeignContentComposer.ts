import {Element} from '../../decl/xml-lite-decl';
import {TagToken, TextToken, Token} from '../tokens';
import {NS_HTML, NS_MATHML, NS_SVG} from './BaseComposer';
import {InsertionMode} from './insertion-mode';
import {TokenAdjustingComposer} from './TokenAdjustingComposer';

export class InForeignContentComposer extends TokenAdjustingComposer {
  inForeignContent(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
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
        this.popUntilMatches(this.isHTMLContentRestricted);
        return this.process(token);
      default:
        return this.inForeignContentStartTagDefault(token);
    }
  }

  inForeignContentStartTagDefault(token: TagToken): InsertionMode {
    const adjustedNode = this.adjustedCurrentNode;
    if (adjustedNode.namespaceURI === NS_MATHML)
      this.adjustMathMLAttributes(token);
    else if (adjustedNode.namespaceURI === NS_SVG) {
      this.adjustSvgTagName(token);
      this.adjustSvgAttributes(token);
    }
    this.adjustForeignAttributes(token);
    this.createAndInsertElementNS(token, adjustedNode.namespaceURI, token.selfClosing);
    return this.insertionMode;
  }

  inForeignContentEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'br':
      case 'p':
        this.error();
        this.popUntilMatches(this.isHTMLContentRestricted);
        return this.process(token);
      default:
        if (token.name !== (this.current as Element).tagName.toLowerCase())
          this.error();
        for (let i = this.openElements.length - 1; i > 0; --i) {
          let node = this.openElements[i];
          if (node.namespaceURI === NS_HTML) return this.process(token);
          if (node.tagName.toLowerCase() === token.name) {
            while (this.openElements.length >= i) {
              this.popCurrentElement();
            }
            break;
          }
        }
    }
    return this.insertionMode;
  }

  isHTMLContentRestricted(name: string, element: Element): boolean {
    return !(element.namespaceURI === NS_HTML || this.isMathMLIntegrationPoint(element) || this.isHTMLIntegrationPoint(element));
  }
}