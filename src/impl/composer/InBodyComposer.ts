import {Element} from '../../decl/xml-lite-decl';
import {StaticAttr} from '../nodes/StaticAttr';
import {StaticAttributes} from '../nodes/StaticAttributes';
import {StaticElement} from '../nodes/StaticElement';
import {TagToken, TextToken, Token} from '../tokens';
import {NS_HTML, NS_MATHML, NS_SVG} from './BaseComposer';
import {InsertionMode} from './insertion-mode';
import {TokenAdjustingComposer} from './TokenAdjustingComposer';

export class InBodyComposer extends TokenAdjustingComposer {
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
          if (this.hasExplicitlyClosableOnStack())
            this.error();
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
    let element: Element;
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
        if (this.hasElementInButtonScope('p'))
          this.closeParagraph();
        this.createAndInsertHTMLElement(token);
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        if (this.hasElementInButtonScope('p'))
          this.closeParagraph();
        if (this.current.namespaceURI === NS_HTML) {
          switch (this.current.tagName) {
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
        if (this.hasElementInButtonScope('p'))
          this.closeParagraph();
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        break;
      case 'form':
        if (this.formElement && !this.openCounts['template']) {
          this.error();
        } else {
          if (this.hasElementInButtonScope('p'))
            this.closeParagraph();
          const element = this.createAndInsertHTMLElement(token);
          if (!this.openCounts['template'])
            this.formElement = element;
        }
        break;
      case 'li':
        return this.inBodyStartTagLi(token);
      case 'dt':
      case 'dd':
        return this.inBodyStartTagDt(token);
      case 'plaintext':
        if (this.hasElementInButtonScope('p'))
          this.closeParagraph();
        this.createAndInsertHTMLElement(token);
        this.tokenizer.state = 'plaintext';
        break;
      case 'button':
        if (this.openCounts['button']) {
          this.error();
          this.generateImpliedEndTags();
          this.popUntilName('button');
        }
        this.reconstructFormattingElements();
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        break;
      case 'a':
        return this.inBodyStartTagAnchor(token);
      case 'b':
      case 'big':
      case 'code':
      case 'em':
      case 'font':
      case 'i':
      case 's':
      case 'small':
      case 'strike':
      case 'strong':
      case 'tt':
      case 'u':
        this.reconstructFormattingElements();
        this.formattingElements.push(this.createAndInsertHTMLElement(token));
        break;
      case 'nobr':
        this.reconstructFormattingElements();
        if (this.hasElementInScope('nobr')) {
          this.error();
          this.adoptionAgency(token);
          this.reconstructFormattingElements();
        }
        this.formattingElements.push(this.createAndInsertHTMLElement(token));
        break;
      case 'applet':
      case 'marquee':
      case 'object':
        this.reconstructFormattingElements();
        this.createAndInsertHTMLElement(token);
        this.insertFormattingMarker();
        this.framesetOk = false;
        break;
      case 'table':
        if (this.hasElementInButtonScope('p'))
          this.closeParagraph();
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        return 'inTable';
      case 'area':
      case 'br':
      case 'embed':
      case 'img':
      case 'keygen':
      case 'wbr':
        this.reconstructFormattingElements();
        this.createAndInsertEmptyHTMLElement(token);
        this.framesetOk = false;
        break;
      case 'input':
        this.reconstructFormattingElements();
        element = this.createAndInsertEmptyHTMLElement(token);
        if (!element.hasAttribute('type') || (element.getAttribute('type') || '').toLowerCase() !== 'hidden')
          this.framesetOk = false;
        break;
      case 'param':
      case 'source':
      case 'track':
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'hr':
        if (this.hasElementInButtonScope('p'))
          this.closeParagraph();
        this.createAndInsertEmptyHTMLElement(token);
        this.framesetOk = false;
        break;
      case 'image':
        this.error();
        token.name = 'img';
        return this.inBodyStartTag(token);
      case 'textarea':
        this.framesetOk = false;
        return this.startTextMode('rcdata', token);
      case 'xmp':
        if (this.hasElementInButtonScope('p'))
          this.closeParagraph();
        this.reconstructFormattingElements();
      case 'iframe': // ok no break
        this.framesetOk = false;
      case 'noembed': // ok no break
        return this.startTextMode('rawtext', token);
      case 'select':
        this.reconstructFormattingElements();
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        switch (this.insertionMode) {
          case 'inTable':
          case 'inCaption':
          case 'inTableBody':
          case 'inRow':
          case 'inCell':
            return 'inSelectInTable';
          default:
            return 'inSelect';
        }
      case 'optgroup':
      case 'option':
        if (this.current.tagName === 'option')
          this.popCurrentElement();
        this.reconstructFormattingElements();
        this.createAndInsertHTMLElement(token);
        break;
      case 'rb':
      case 'rtc':
        if (this.hasElementInScope('ruby')) {
          this.generateImpliedEndTags();
          if (this.current.tagName !== 'ruby')
            this.error();
        }
        this.createAndInsertHTMLElement(token);
        break;
      case 'rp':
      case 'rt':
        if (this.hasElementInScope('ruby')) {
          this.generateImpliedEndTags('rtc');
          if (this.current.tagName !== 'rtc' && this.current.tagName !== 'ruby')
            this.error();
        }
        this.createAndInsertHTMLElement(token);
        break;
      case 'math':
        this.reconstructFormattingElements();
        this.adjustMathMLAttributes(token);
        this.adjustForeignAttributes(token);
        this.createAndInsertElementNS(token, NS_MATHML, token.selfClosing, false);
        break;
      case 'svg':
        this.reconstructFormattingElements();
        this.adjustSvgAttributes(token);
        this.adjustForeignAttributes(token);
        this.createAndInsertElementNS(token, NS_SVG, token.selfClosing, false);
        break;
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'frame':
      case 'head':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        this.error();
        break;
      default:
        this.reconstructFormattingElements();
        this.createAndInsertHTMLElement(token);
    }
    return this.insertionMode;
  }

  inBodyEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        return this.inHead(token);
      case 'body':
      case 'html':
        if (this.openCounts['body']) {
          if (this.hasExplicitlyClosableOnStack())
            this.error();
          return token.name === 'body' ? 'afterBody' : this.reprocessIn('afterBody', token);
        }
        this.error();
        break;
      case 'address':
      case 'article':
      case 'aside':
      case 'blockquote':
      case 'button':
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
      case 'listing':
      case 'main':
      case 'menu':
      case 'nav':
      case 'ol':
      case 'pre':
      case 'search':
      case 'section':
      case 'summary':
      case 'ul':
        if (this.hasElementInScope(token.name)) {
          this.generateImpliedEndTags();
          if (this.current.tagName !== token.name)
            this.error();
          this.popUntilName(token.name);
        } else
          this.error();
        break;
      case 'form':
        this.inBodyEndTagForm();
        break;
      case 'p':
        if (!this.hasElementInButtonScope('p')) {
          this.error();
          this.createAndInsertHTMLElement({type: 'startTag', name: 'p', selfClosing: false, attributes: []});
        }
        this.closeParagraph();
        break;
      case 'li':
        if (this.hasElementInListScope('li')) {
          this.generateImpliedEndTags('li');
          if (this.current.namespaceURI !== NS_HTML || this.current.tagName !== 'li') {
            this.error();
            this.popUntilName('li');
          } else
            this.popCurrentElement();
        } else
          this.error();
        break;
      case 'dd':
      case 'dt':
        if (this.hasElementInScope(token.name)) {
          this.generateImpliedEndTags(token.name);
          if (this.current.namespaceURI !== NS_HTML || this.current.tagName !== token.name) {
            this.error();
            this.popUntilName(token.name);
          } else
            this.popCurrentElement();
        } else
          this.error();
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        if (this.hasMatchInScope(el => this.isHeaderLevelElement(el), el => this.isScopeFence(el))) {
          this.generateImpliedEndTags();
          if (this.current.namespaceURI !== NS_HTML || this.current.tagName !== token.name) {
            this.error();
            this.popUntilMatches((name, el) => !this.isHeaderLevelElement(el));
            this.popCurrentElement();
          } else
            this.popCurrentElement();
        } else
          this.error();
        break;
      case 'a':
      case 'b':
      case 'big':
      case 'code':
      case 'em':
      case 'font':
      case 'i':
      case 'nobr':
      case 's':
      case 'small':
      case 'strike':
      case 'strong':
      case 'tt':
      case 'u':
        this.adoptionAgency(token);
        break;
      case 'applet':
      case 'marquee':
      case 'object':
        if (this.hasElementInScope(token.name)) {
          this.generateImpliedEndTags();
          if (this.current.namespaceURI !== NS_HTML || this.current.tagName !== token.name) {
            this.error();
            this.popUntilName(token.name);
          } else
            this.popCurrentElement();
        } else
          this.error();
        this.clearFormattingUpToMarker();
        break;
      case 'br':
        return this.inBodyStartTag({type: 'startTag', name: 'br', selfClosing: false, attributes: []});
      default:
        return this.inBodyEndTagDefault(token);
    }
    return this.insertionMode;
  }

  isHeaderLevelElement(element: Element) {
    if (element.namespaceURI !== NS_HTML) return false;
    switch (element.tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return true;
      default:
        return false;
    }
  }

  inBodyEndTagForm() {
    if (this.openCounts['template']) {
      if (this.hasElementInScope('form')) {
        this.generateImpliedEndTags();
        if (this.current.tagName !== 'form') {
          this.error();
          this.popUntilName('form');
        } else
          this.popCurrentElement();
      } else
        this.error();
    } else {
      const form = this.formElement;
      this.formElement = null;
      if (form && this.isElementInScope(form)) {
        this.generateImpliedEndTags();
        if (this.current !== form) {
          this.error();
          this.removeFromStack(form);
        } else
          this.popCurrentElement();
      } else
        this.error();
    }
  }

  inBodyEndTagDefault(token: TagToken): InsertionMode {
    for (let i = this.openElements.length - 1; i >= 0; --i) {
      const node = this.openElements[i];
      if (token.name === node.tagName && node.namespaceURI === NS_HTML) {
        this.generateImpliedEndTags(token.name);
        if (this.current !== node)
          this.error();
        while (this.openElements.length > i)
          this.popCurrentElement();
        break;
      } else if (this.isSpecial(node)) {
        this.error();
        break;
      }
    }
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

  inBodyStartTagLi(token: TagToken): InsertionMode {
    this.framesetOk = false;
    for (let i = this.openElements.length - 1; ; --i) {
      const node = this.openElements[i];
      const tagName = node.tagName;
      if (tagName === 'li') {
        this.generateImpliedEndTags('li');
        if (this.current.tagName !== 'li')
          this.error();
        this.popUntilName('li');
        break;
      } else if (this.isSpecial(node) && tagName !== 'address' && tagName !== 'div' && tagName !== 'p')
        break;
    }
    if (this.hasElementInButtonScope('p'))
      this.closeParagraph();
    this.createAndInsertHTMLElement(token);
    return this.insertionMode;
  }

  inBodyStartTagDt(token: TagToken): InsertionMode {
    this.framesetOk = false;
    for (let i = this.openElements.length - 1; ; --i) {
      const node = this.openElements[i];
      const tagName = node.tagName;
      if (tagName === 'dd') {
        this.generateImpliedEndTags('dd');
        if (this.current.tagName !== 'dd')
          this.error();
        this.popUntilName('dd');
        break;
      } else if (tagName === 'dt') {
        this.generateImpliedEndTags('dt');
        if (this.current.tagName !== 'dt')
          this.error();
        this.popUntilName('dt');
        break;
      } else if (this.isSpecial(node) && tagName !== 'address' && tagName !== 'div' && tagName !== 'p') {
        break;
      }
    }
    if (this.hasElementInButtonScope('p'))
      this.closeParagraph();
    this.createAndInsertHTMLElement(token);
    return this.insertionMode;
  }

  inBodyStartTagAnchor(token: TagToken): InsertionMode {
    let activeAnchor = this.getActiveFormattingElement('a');
    if (activeAnchor) {
      this.error();
      this.adoptionAgency(token);
      this.removeFormattingElement(activeAnchor);
      this.removeFromStack(activeAnchor);
    }
    this.reconstructFormattingElements();
    const element = this.createAndInsertHTMLElement(token);
    this.formattingElements.push(element);
    return this.insertionMode;
  }

  hasExplicitlyClosableOnStack(): boolean {
    for (let i = this.openElements.length - 1; i >= 0; --i) {
      switch (this.openElements[i].tagName) {
        case 'dd':
        case 'dt':
        case 'li':
        case 'optgroup':
        case 'option':
        case 'p':
        case 'rb':
        case 'rp':
        case 'rt':
        case 'rtc':
        case 'tbody':
        case 'td':
        case 'tfoot':
        case 'th':
        case 'thead':
        case 'tr':
        case 'body':
        case 'html':
          continue;
        default:
          return true;
      }
    }
    return false;
  }
  adoptionAgency(token: TagToken) { // TODO this requires active tree modification which is not possible with current implementation
  }
}