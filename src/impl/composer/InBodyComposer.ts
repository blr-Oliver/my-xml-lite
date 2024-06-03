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
        return this.inBodyStartTagLi(token);
      case 'dt':
      case 'dd':
        return this.inBodyStartTagDt(token);
      case 'plaintext':
        if (this.hasParagraphInButtonScope())
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
        if (this.hasParagraphInButtonScope())
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
        if (this.hasParagraphInButtonScope())
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
        if (this.hasParagraphInButtonScope())
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
    return this.insertionMode;
  }

  inBodyEndTagDefault(token: TagToken): InsertionMode {
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
    if (this.hasParagraphInButtonScope())
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
    if (this.hasParagraphInButtonScope())
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

  adoptionAgency(token: TagToken) { // TODO this requires active tree modification which is not possible with current implementation
  }
}