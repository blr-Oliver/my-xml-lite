import {Element} from '../../decl/xml-lite-decl';
import {StaticAttr} from '../nodes/StaticAttr';
import {StaticAttributes} from '../nodes/StaticAttributes';
import {StaticElement} from '../nodes/StaticElement';
import {CharactersToken, CommentToken, TagToken, Token} from '../tokens';
import {NS_HTML, NS_MATHML, NS_SVG} from './BaseComposer';
import {InsertionMode} from './insertion-mode';
import {TokenAdjustingComposer} from './TokenAdjustingComposer';

export class InBodyComposer extends TokenAdjustingComposer {
  inBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        this.reconstructFormattingElements();
        this.insertCharacters(token as CharactersToken);
        this.framesetOk &&= (token as CharactersToken).whitespaceOnly;
        break;
      case 'eof':
        if (this.templateInsertionModes.length) return this.inTemplate(token);
        else {
          if (this.hasExplicitlyClosableOnStack())
            this.error('abrupt-end-of-document');
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
        this.error('unexpected-html-start-tag');
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
        this.error('unexpected-body-start-tag');
        if (this.openElements.length > 1 && this.openElements[1].tagName === 'body' && !this.openCounts['template']) {
          this.framesetOk = false;
          this.addMissingAttributes(this.openElements[1], token);
        }
        break;
      case 'frameset':
        this.error('frameset-in-body');
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
      case 'listing':
      case 'pre':
        this.framesetOk = false;
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
          this.forceCloseElement('p');
        this.createAndInsertHTMLElement(token);
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        if (this.hasElementInButtonScope('p'))
          this.forceCloseElement('p');
        if (this.current.namespaceURI === NS_HTML) {
          switch (this.current.tagName) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
              this.error('immediately-nested-heading-start-tag');
              this.popCurrentElement();
          }
        }
        this.createAndInsertHTMLElement(token);
        break;
      case 'form':
        if (this.formElement && !this.openCounts['template']) {
          this.error('nested-form');
        } else {
          if (this.hasElementInButtonScope('p'))
            this.forceCloseElement('p');
          const element = this.createAndInsertHTMLElement(token);
          if (!this.openCounts['template'])
            this.formElement = element;
        }
        break;
      case 'li':
        return this.inBodyStartItemTag(token, 'li');
      case 'dt':
      case 'dd':
        return this.inBodyStartItemTag(token, 'dd', 'dt');
      case 'plaintext':
        if (this.hasElementInButtonScope('p'))
          this.forceCloseElement('p');
        this.createAndInsertHTMLElement(token);
        this.tokenizer.state = 'plaintext';
        break;
      case 'button':
        if (this.hasElementInScope('button')) {
          this.error('nested-button');
          // https://github.com/whatwg/html/issues/10476
          // this.generateImpliedEndTags();
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
          this.error('nested-nobr');
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
          this.forceCloseElement('p');
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        return 'inTable';
      case 'image':
        this.error('deprecated-image-tag');
        token.name = 'img';
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
          this.forceCloseElement('p');
        this.createAndInsertEmptyHTMLElement(token);
        this.framesetOk = false;
        break;
      case 'textarea':
        this.framesetOk = false;
        return this.startTextMode('rcdata', token);
      case 'xmp':
        if (this.hasElementInButtonScope('p'))
          this.forceCloseElement('p');
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
            this.error('parent-not-ruby');
        }
        this.createAndInsertHTMLElement(token);
        break;
      case 'rp':
      case 'rt':
        if (this.hasElementInScope('ruby')) {
          this.generateImpliedEndTags('rtc');
          if (this.current.tagName !== 'ruby' && this.current.tagName !== 'rtc')
            this.error('parent-not-ruby');
        }
        this.createAndInsertHTMLElement(token);
        break;
      case 'math':
        this.reconstructFormattingElements();
        this.adjustMathMLAttributes(token);
        this.adjustForeignAttributes(token);
        this.createAndInsertElementNS(token, NS_MATHML, token.selfClosed, false);
        break;
      case 'svg':
        this.reconstructFormattingElements();
        this.adjustSvgAttributes(token);
        this.adjustForeignAttributes(token);
        this.createAndInsertElementNS(token, NS_SVG, token.selfClosed, false);
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
        this.error('unexpected-start-tag-in-body');
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
        return this.endTemplate();
      case 'body':
      case 'html':
        if (this.openCounts['body']) {
          if (this.hasExplicitlyClosableOnStack())
            this.error('abrupt-end-of-content');
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
        if (this.hasElementInScope(token.name))
          this.forceCloseElement(token.name);
        else
          this.error('orphan-end-tag');
        break;
      case 'form':
        this.inBodyEndTagForm();
        break;
      case 'p':
        if (!this.hasElementInButtonScope('p')) {
          this.error('orphan-p-end-tag');
          this.createAndInsertHTMLElement({type: 'startTag', name: 'p', selfClosed: false, attributes: []});
        }
        this.forceCloseElement('p');
        break;
      case 'li':
        if (this.hasElementInListScope('li'))
          this.forceCloseElement('li');
        else
          this.error('orphan-end-tag');
        break;
      case 'dd':
      case 'dt':
        if (this.hasElementInScope(token.name))
          this.forceCloseElement(token.name);
        else
          this.error('orphan-end-tag');
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
            this.error('mismatched-heading-end-tag');
            this.popWhileMatches((name, el) => !this.isHeaderLevelElement(el));
            this.popCurrentElement();
          } else
            this.popCurrentElement();
        } else
          this.error('orphan-end-tag');
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
          this.forceCloseElement(token.name);
          this.clearFormattingUpToMarker();
        } else
          this.error('orphan-end-tag');
        break;
      case 'br':
        this.error('br-end-tag');
        return this.inBodyStartTag({type: 'startTag', name: 'br', selfClosed: false, attributes: []});
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
      if (this.hasElementInScope('form'))
        this.forceCloseElement('form');
      else
        this.error('orphan-end-tag');
    } else {
      const form = this.formElement;
      this.formElement = null;
      if (form && this.isElementInScope(form)) {
        this.generateImpliedEndTags();
        if (this.current !== form) {
          this.error('element-closed-before-children');
          this.removeFromStack(form);
        } else
          this.popCurrentElement();
      } else
        this.error('orphan-end-tag');
    }
  }

  inBodyEndTagDefault(token: TagToken): InsertionMode {
    for (let i = this.openElements.length - 1; i >= 0; --i) {
      const node = this.openElements[i];
      if (token.name === node.tagName && node.namespaceURI === NS_HTML) {
        this.generateImpliedEndTags(token.name);
        if (this.current !== node)
          this.error('element-closed-before-children');
        while (this.openElements.length > i)
          this.popCurrentElement();
        break;
      } else if (this.isSpecial(node)) {
        this.error('orphan-end-tag-inside-special-element');
        break;
      }
    }
    return this.insertionMode;
  }

  addMissingAttributes(element: Element, token: TagToken) {
    for (let attrToken of token.attributes) {
      if (!element.hasAttribute(attrToken.name))
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

  inBodyStartItemTag(token: TagToken, name1: 'li' | 'dt' | 'dd', name2?: 'li' | 'dt' | 'dd') {
    this.framesetOk = false;
    for (let i = this.openElements.length - 1; ; --i) {
      const node = this.openElements[i];
      const tagName = node.tagName;
      if ((tagName === name1 || tagName === name2) && node.namespaceURI === NS_HTML) {
        this.forceCloseElement(tagName);
        break;
      } else if (this.isSpecial(node) && tagName !== 'address' && tagName !== 'div' && tagName !== 'p') {
        break;
      }
    }
    if (this.hasElementInButtonScope('p'))
      this.forceCloseElement('p');
    this.createAndInsertHTMLElement(token);
    return this.insertionMode;
  }

  inBodyStartTagAnchor(token: TagToken): InsertionMode {
    let activeAnchor = this.getActiveFormattingElement('a');
    if (activeAnchor) {
      this.error('nested-anchor');
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
    if (token.name === this.current.tagName)
      this.popCurrentElement();
  }
}