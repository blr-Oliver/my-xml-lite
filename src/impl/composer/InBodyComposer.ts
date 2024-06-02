import {Element} from '../../decl/xml-lite-decl';
import {StaticAttr} from '../nodes/StaticAttr';
import {StaticAttributes} from '../nodes/StaticAttributes';
import {StaticElement} from '../nodes/StaticElement';
import {TagToken, TextToken, Token} from '../tokens';
import {BaseComposer, NS_HTML} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InBodyComposer extends BaseComposer {
  inBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace and NUL characters
        this.reconstructFormattingElements();
        this.insertDataNode(token as TextToken);
        this.framesetOk = false;
        break;
      case 'eof':
        if (this.templateInsertionModes.length) return this.inTemplate(token);
        else {
          // TODO error when stack should be properly closed
          return this.stopParsing();
        }
      case 'startTag':
        return this.inBodyStartTag(token as TagToken);
      case 'endTag':
        return this.inBodyEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  inBodyStartTag(token: TagToken): InsertionMode {
    const current = this.current;
    switch (token.name) {
      case 'html':
        this.error();
        if (!this.openCounts['template'])
          this.addMissingAttributes(this.openElements[0], token);
        break;
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
      case 'body':
        this.error();
        if (this.openElements.length > 1 && this.openElements[1].tagName === 'body' && !this.openCounts['template']) {
          this.framesetOk = false;
          this.addMissingAttributes(this.openElements[1], token);
        }
        break;
      case 'frameset':
        this.error();
        if (this.openElements.length > 1 && this.openElements[1].tagName === 'body' && !this.openCounts['template']) {
          if (this.framesetOk) {
            this.removeElementFromParent(this.openElements[0], this.openElements[1]);
            while (this.openElements.length > 1)
              this.popCurrentElement();
            this.createAndInsertHTMLElement(token);
            return 'inFrameset';
          }
        }
        break;
      case 'address':
      case 'article':
      case 'aside':
      case 'blockquote':
      case 'center':
      case 'details':
      case 'dialog':
      case 'dir':
      case 'div':
      case 'dl':
      case 'fieldset':
      case 'figcaption':
      case 'figure':
      case 'footer':
      case 'header':
      case 'hgroup':
      case 'main':
      case 'menu':
      case 'nav':
      case 'ol':
      case 'p':
      case 'search':
      case 'section':
      case 'summary':
      case 'ul':
        if (this.hasParagraphInButtonScope())
          this.closeParagraph();
        this.createAndInsertHTMLElement(token);
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        if (this.hasParagraphInButtonScope())
          this.closeParagraph();
        if (current.namespaceURI === NS_HTML) {
          switch (current.tagName) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
              this.error();
              this.popCurrentElement();
          }
        }
        this.createAndInsertHTMLElement(token);
        break;
      case 'pre':
      case 'listing':
        if (this.hasParagraphInButtonScope())
          this.closeParagraph();
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        break;
      case 'form':
        if (this.formElement && !this.openCounts['template']) {
          this.error();
        } else {
          if (this.hasParagraphInButtonScope())
            this.closeParagraph();
          const element = this.createAndInsertHTMLElement(token);
          if (!this.openCounts['template'])
            this.formElement = element;
        }
        break;
      case 'li':
        return this.inBodyStartLiTag(token);
      case 'dt':
      case 'dd':
        // TODO
    }
    return this.insertionMode;
  }

  inBodyEndTag(token: TagToken): InsertionMode {
    return this.insertionMode;
  }

  addMissingAttributes(element: Element, token: TagToken) {
    for (let attrToken of token.attributes) {
      if (!element.hasAttribute(token.name))
        (element.attributes as StaticAttributes).addAttributeNode(new StaticAttr(attrToken, element));
    }
  }

  removeElementFromParent(parent: Element, child: Element) {
    const staticParent = parent as StaticElement;
    const staticChild = child as StaticElement;
    staticParent.childNodes.splice(staticChild.parentIndex, 1);
    staticParent.children.splice(staticChild.parentElementIndex, 1);
    staticParent.childNodes.forEach(this.setNodeIndex, this);
    staticParent.children.forEach(this.setElementIndex, this);
  }

  hasParagraphInButtonScope(): boolean { // TODO
    return this.openCounts['p'] > 0;
  }

  inBodyStartLiTag(token: TagToken): InsertionMode { // TODO
    this.framesetOk = false;
    return this.insertionMode;
  }
}