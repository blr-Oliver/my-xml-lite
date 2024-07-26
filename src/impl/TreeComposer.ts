import {CharacterData, Document, Element, isDocument, isElement, Node, ParentNode} from '../decl/xml-lite-decl';
import {FormattingList} from './FormattingList';
import {InsertionMode} from './interfaces/insertion-mode';
import {NodeFactory} from './interfaces/NodeFactory';
import {TokenSink} from './interfaces/ParserEnvironment';
import {State} from './interfaces/states';
import {CharactersToken, CommentToken, DoctypeToken, NamespacedAttribute, TagToken, Token} from './interfaces/tokens';
import {Tokenizer} from './Tokenizer';

export const NS_HTML = 'http://www.w3.org/1999/xhtml';
export const NS_MATHML = 'http://www.w3.org/1998/Math/MathML';
export const NS_SVG = 'http://www.w3.org/2000/svg';
export const NS_XLINK = 'http://www.w3.org/1999/xlink';
export const NS_XML = 'http://www.w3.org/XML/1998/namespace';
export const NS_XMLNS = 'http://www.w3.org/2000/xmlns/';

// TODO analyze all namespace checks for necessity
export class TreeComposer implements TokenSink {
  nodeFactory: NodeFactory;

  tokenizer!: Tokenizer;
  insertionMode!: InsertionMode;
  originalInsertionMode!: InsertionMode;
  templateInsertionModes: InsertionMode[] = [];

  document!: Document;
  contextElement?: Element;

  openElements: Element[] = [];
  openCounts: { [tagName: string]: number } = {};

  headElement: Element | null = null;
  formElement: Element | null = null;

  pendingTableCharacters: CharactersToken[] = [];
  fosterParentingEnabled: boolean = false;

  framesetOk: boolean = true;

  formattingList: FormattingList = new FormattingList();

  insertParent!: ParentNode;
  insertBefore?: Node;

  constructor(nodeFactory: NodeFactory) {
    this.nodeFactory = nodeFactory;
  }

  get current(): Element {
    return this.openElements[this.openElements.length - 1];
  }
  get adjustedCurrentNode(): Element {
    return this.openElements.length <= 1 ? (this.contextElement || this.openElements[0]) : this.openElements[this.openElements.length - 1];
  }

  reset(contextElement?: Element) {
    this.templateInsertionModes.length = 0;
    this.openElements.length = 0;
    this.openCounts = {};
    this.headElement = null;
    this.formElement = null;
    this.pendingTableCharacters.length = 0;
    this.fosterParentingEnabled = false;
    this.framesetOk = true;
    this.formattingList.reset();
    this.document = this.nodeFactory.createDocument();
    if (!(this.contextElement = contextElement)) {
      this.tokenizer.state = 'data';
      this.setInsertionMode('initial');
    } else
      this.resetForFragmentCase(contextElement!);
  }

  resetForFragmentCase(contextElement: Element) {
    switch (contextElement.tagName) {
      case 'title':
      case 'textarea':
        this.tokenizer.state = 'rcdata';
        break;
      case 'style':
      case 'xmp':
      case 'iframe':
      case 'noembed':
      case 'noframes':
        this.tokenizer.state = 'rawtext';
        break;
      case 'script':
        this.tokenizer.state = 'scriptData';
        break;
      case 'plaintext':
        this.tokenizer.state = 'plaintext'
        break;
      default:
        this.tokenizer.state = 'data';
    }
    const root = this.createElementNS({type: 'startTag', name: 'html', selfClosed: false, attributes: []}, NS_HTML, this.document);
    this.pushOpenElement(root);
    if (contextElement.tagName === 'template')
      this.templateInsertionModes.push('inTemplate');
    this.resetInsertionMode();
    for (let el: Element | null = contextElement; el; el = el.parentElement)
      if (el.tagName === 'form') {
        this.formElement = el;
        break;
      }
  }

  accept(token: Token) {
    if (token.type !== 'eof' && this.shouldUseForeignRules(token))
      this.setInsertionMode(this.inForeignContent(token));
    else this.setInsertionMode(this.process(token));
  }

  shouldUseForeignRules(token?: Token): boolean {
    // TODO this should be carefully optimized
    if (!this.openElements.length) return false;
    const adjustedNode = this.adjustedCurrentNode;
    if (adjustedNode.namespaceURI === NS_HTML) return false;
    if (!token)
      return !this.isMathMLIntegrationPoint(adjustedNode) && !this.isHTMLIntegrationPoint(adjustedNode);
    if (this.isMathMLIntegrationPoint(adjustedNode)) {
      if (token.type === 'characters') return false;
      if (token.type === 'startTag' && (token as TagToken).name !== 'mglyph' && (token as TagToken).name !== 'malignmark') return false;
    }
    if (adjustedNode.namespaceURI === NS_MATHML && adjustedNode.tagName === 'annotation-xml') {
      if (token.type === 'startTag' && (token as TagToken).name === 'svg') return false;
    }
    if (this.isHTMLIntegrationPoint(adjustedNode)) {
      if (token.type === 'characters' || token.type === 'startTag') return false;
    }
    return true;
  }

  process(token: Token): InsertionMode {
    // @ts-ignore
    return this[this.insertionMode](token);
  }

  reprocessIn(mode: InsertionMode, token: Token): InsertionMode {
    this.setInsertionMode(mode);
    return this.process(token);
  }

  setInsertionMode(value: InsertionMode) {
    if (this.insertionMode === value) return;
    switch (this.insertionMode = value) {
      case 'initial':
      case 'beforeHtml':
      case 'beforeHead':
        return this.tokenizer.whitespaceMode = 'ignoreLeading';
      case 'inHead':
      case 'inHeadNoscript':
      case 'afterHead':
      case 'inColumnGroup':
      case 'afterBody':
      case 'afterAfterBody':
        return this.tokenizer.whitespaceMode = 'emitLeading';
      case 'inBody':
      case 'text':
      case 'inTable':
      case 'inTableText':
      case 'inCaption':
      case 'inTableBody':
      case 'inRow':
      case 'inCell':
      case 'inSelect':
      case 'inSelectInTable':
      case 'inTemplate':
        return this.tokenizer.whitespaceMode = 'mixed';
      case 'inFrameset':
      case 'afterFrameset':
      case 'afterAfterFrameset':
        return this.tokenizer.whitespaceMode = 'whitespaceOnly';
    }
  }

  resetInsertionMode() {
    this.setInsertionMode(this.computeInsertionMode());
  }

  computeInsertionMode(): InsertionMode {
    for (let i = this.openElements.length - 1; ; --i) {
      let node = i === 0 && this.contextElement ? this.contextElement : this.openElements[i];
      switch (node.tagName) {
        case 'select':
          for (let j = i - 1; j >= 0; --j) { // are we in table?
            switch (this.openElements[j].tagName) {
              case 'table':
                return 'inSelectInTable';
              case 'template':
                return 'inSelect';
            }
          }
          return 'inSelect';
        case 'td':
        case 'th':
          return i === 0 ? 'inBody' : 'inCell';
        case 'tr':
          return 'inRow';
        case 'tbody':
        case 'thead':
        case 'tfoot':
          return 'inTableBody';
        case 'caption':
          return 'inCaption';
        case 'colgroup':
          return 'inColumnGroup';
        case 'table':
          return 'inTable';
        case 'template':
          return this.templateInsertionModes.at(-1)!;
        case 'head':
          return 'inHead';
        case 'body':
          return 'inBody';
        case 'frameset':
          return 'inFrameset';
        case 'html':
          return this.headElement ? 'afterHead' : 'beforeHead';
        default:
          if (i === 0) return 'inBody';
      }
    }
  }

  text(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
      case 'cdata':
        this.insertCharacters(token as CharactersToken);
        break;
      case 'eof':
        this.error('abrupt-end-of-text');
        this.popCurrentElement();
        return this.reprocessIn(this.originalInsertionMode, token);
      case 'endTag':
        this.popCurrentElement();
        return this.originalInsertionMode;
    }
    return this.insertionMode;
  }

  isMathMLIntegrationPoint(element: Element): boolean {
    if (element.namespaceURI !== NS_MATHML) return false;
    switch (element.tagName) {
      case 'mi':
      case 'mo':
      case 'mn':
      case 'ms':
      case 'mtext':
        return true;
      default:
        return false;
    }
  }

  isHTMLIntegrationPoint(element: Element): boolean {
    switch (element.namespaceURI) {
      case NS_MATHML:
        if (element.tagName !== 'annotation-xml') return false;
        let encoding = element.getAttribute('encoding');
        return !!encoding && ((encoding = encoding!.toLowerCase()) === 'text/html' || encoding === 'application/xhtml+xml');
      case NS_SVG:
        switch (element.tagName) {
          case 'desc':
          case 'foreignObject':
          case 'title':
            return true;
          default:
            return false;
        }
      default:
        return false;
    }
  }

  insertDoctype(doctypeToken: DoctypeToken) {
    const documentType = this.nodeFactory.createDoctype(this.document, doctypeToken.name ?? 'html', doctypeToken.publicId, doctypeToken.systemId);
    this.nodeFactory.appendNode(this.document, documentType);
  }

  insertComment(token: CommentToken, override?: ParentNode) {
    this.updateInsertionLocation(override);
    this.insertNodeAtCurrentLocation(this.nodeFactory.createComment(this.insertParent, token.data), false);
  }

  insertCharacters(token: CharactersToken) {
    this.updateInsertionLocation();
    if (!isDocument(this.insertParent)) {
      let node: CharacterData;
      switch (token.type) {
        case 'characters':
          node = this.nodeFactory.createText(this.insertParent, token.data);
          break;
        case 'cdata':
          node = this.nodeFactory.createCData(this.insertParent, token.data);
      }
      this.insertNodeAtCurrentLocation(node, false);
    }
  }

  generateImpliedEndTags(exclude?: string) {
    const stack = this.openElements;
    for (let i = stack.length - 1; i >= 0; --i) {
      const element = stack[i];
      if (element.namespaceURI !== NS_HTML) return;
      const tagName = element.tagName;
      if (tagName === exclude) return;
      switch (tagName) {
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
          this.popCurrentElement();
          continue;
        default:
          return;
      }
    }
  }

  generateImpliedEndTagsThoroughly() {
    const stack = this.openElements;
    for (let i = stack.length - 1; i >= 0; --i) {
      const element = stack[i];
      if (element.namespaceURI !== NS_HTML) return;
      switch (element.tagName) {
        case 'caption':
        case 'colgroup':
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
          this.popCurrentElement();
          continue;
        default:
          return;
      }
    }
  }

  forceElementAndState(element: string, state: InsertionMode, token: Token): InsertionMode {
    this.createAndInsertHTMLElement({
      type: 'startTag',
      name: element,
      selfClosed: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn(state, token);
  }

  createElementNS(token: TagToken, namespace: string | null, parent: ParentNode): Element {
    const element = this.nodeFactory.createElement(parent, token, namespace);
    this.validateNsAttributes(element);
    return element;
  }

  validateNsAttributes(element: Element) {
    if (element.hasAttribute('xmlns')) {
      const attr = element.getAttributeNode('xmlns')!;
      if (attr.namespaceURI === NS_XMLNS && attr.localName === 'xmlns' && attr.value !== element.namespaceURI)
        this.error('mismatched-xmlns-attribute');
    }
    if (element.hasAttribute('xmlns:xlink')) {
      const attr = element.getAttributeNode('xmlns:xlink')!;
      if (attr.namespaceURI === NS_XMLNS && attr.localName === 'xlink' && attr.value !== NS_XLINK)
        this.error('invalid-xlink-namespace');
    }
  }

  /** a-ka "appropriate place for inserting a node" */
  updateInsertionLocation(override?: ParentNode): void {
    const target: ParentNode = this.insertParent = override || this.current || this.document;
    this.insertBefore = undefined;
    if (this.fosterParentingEnabled) {
      if (isElement(target)) {
        switch (target.tagName) {
          case 'table':
          case 'tbody':
          case 'tfoot':
          case 'thead':
          case 'tr':
            let lastTemplateIndex = this.openElements.findLastIndex(el => el.tagName === 'template' && el.namespaceURI === NS_HTML);
            let lastTableIndex = this.openElements.findLastIndex(el => el.tagName === 'table' && el.namespaceURI === NS_HTML);
            if (lastTemplateIndex >= 0 && (lastTableIndex < 0 || lastTemplateIndex > lastTableIndex)) {
              this.insertParent = this.openElements[lastTemplateIndex];
            } else if (lastTableIndex < 0) {
              this.insertParent = this.openElements[0];
            } else {
              this.insertParent = (this.insertBefore = this.openElements[lastTableIndex]).parentNode!;
            }
        }
      }
    }
    if (isElement(this.insertParent) && this.insertParent.tagName === 'template' && this.insertParent.namespaceURI === NS_HTML) {
      // TODO use template contents
    }
  }

  insertNodeAtCurrentLocation(node: Node, isElementHint?: boolean) {
    if (!this.insertBefore) {
      if (isElementHint ?? isElement(node))
        this.nodeFactory.appendElement(this.insertParent, node as Element);
      else
        this.nodeFactory.appendNode(this.insertParent, node);
    } else {
      if (isElementHint ?? isElement(node))
        this.nodeFactory.insertElement(this.insertBefore, node as Element);
      else
        this.nodeFactory.insertNode(this.insertBefore, node);
    }
  }

  /** a-ka "insert a foreign element" */
  createAndInsertElementNS(token: TagToken, namespace: string | null, popImmediately: boolean, onlyAddToStack: boolean = false): Element {
    this.updateInsertionLocation();
    if (!popImmediately && token.selfClosed)
      this.error('non-void-html-element-start-tag-with-trailing-solidus');
    token.selfClosed = popImmediately;
    let element = this.createElementNS(token, namespace, this.insertParent);
    if (!onlyAddToStack)
      this.insertNodeAtCurrentLocation(element, true);
    if (!popImmediately)
      this.pushOpenElement(element);
    return element;
  }

  createAndInsertEmptyHTMLElement(token: TagToken): Element {
    return this.createAndInsertElementNS(token, NS_HTML, true);
  }

  createAndInsertHTMLElement(token: TagToken): Element {
    return this.createAndInsertElementNS(token, NS_HTML, false);
  }

  pushOpenElement(element: Element) {
    this.openElements.push(element);
    this.openCounts[element.tagName] = (this.openCounts[element.tagName] || 0) + 1;
  }

  popCurrentElement() {
    const element = this.openElements.pop()!;
    this.openCounts[element.tagName]--;
  }

  popWhileMatches(test: (name: string, element: Element) => boolean) {
    const stack = this.openElements;
    for (let i = stack.length - 1; i >= 0; --i) {
      const element = stack[i];
      const name = element.tagName;
      if (test(name, element))
        this.popCurrentElement();
      else break;
    }
  }

  popUntilName(name: string, namespace: string = NS_HTML) {
    this.popWhileMatches((n, el) => n !== name || el.namespaceURI !== namespace);
    this.popCurrentElement();
  }

  removeFromStack(element: Element) {
    let index = this.openElements.indexOf(element);
    if (index >= 0) {
      this.openElements.splice(index, 1);
      this.openCounts[element.tagName]--;
    }
  }

  startTextMode(tokenizerState: State, token: TagToken): InsertionMode {
    this.createAndInsertHTMLElement(token);
    this.originalInsertionMode = this.insertionMode;
    this.tokenizer.state = tokenizerState;
    this.tokenizer.lastOpenTag = token.name;
    return 'text';
  }

  startTemplate(token: TagToken): InsertionMode {
    this.insertFormattingMarker();
    this.framesetOk = false;
    this.templateInsertionModes.push('inTemplate');
    this.createAndInsertHTMLElement(token);
    return 'inTemplate';
  }

  endTemplate(): InsertionMode {
    if (this.openCounts['template']) {
      this.generateImpliedEndTagsThoroughly();
      let current = this.current;
      if (current.tagName !== 'template' || current.namespaceURI !== NS_HTML) {
        this.error('abrupt-end-of-template');
        this.popUntilName('template');
      } else
        this.popCurrentElement();
      this.clearFormattingUpToMarker();
      this.templateInsertionModes.pop();
      this.resetInsertionMode();
    } else
      this.error('orphan-end-tag');
    return this.insertionMode;
  }

  error(error?: string) { // TODO
    this.tokenizer.env.errors.push(error || 'error');
  }

  forceCloseElement(name: string) {
    this.generateImpliedEndTags(name);
    if (this.current.tagName !== name || this.current.namespaceURI !== NS_HTML) {
      this.error('element-closed-before-children');
      this.popUntilName(name);
    } else
      this.popCurrentElement();
  }

  closeAnyHangingParagraph() {
    if (this.hasElementInButtonScope('p'))
      this.forceCloseElement('p');
  }

  clearFormattingUpToMarker() { // TODO
    this.formattingList.clearToMarker();
  }

  insertFormattingMarker() { // TODO
    this.formattingList.addMarker();
  }

  pushFormattingElement(element: Element, token: TagToken) { // TODO
    this.formattingList.add(element, token);
  }

  reconstructFormattingElements() { // TODO
    let node = this.formattingList.tail;
    while (node) {
      if (this.openElements.indexOf(node.element) !== -1) break;
      node = node.previous;
    }
    node = node ? node.next : this.formattingList.head;
    while (node) {
      node.element = this.createAndInsertHTMLElement(node.token);
      node = node.next;
    }
  }

  isInFormattingList(element: Element): boolean { // TODO
    return this.formattingList.contains(element);
  }

  getLastFormattingElementForName(name: string): Element | undefined { // TODO
    return this.formattingList.findLatestForName(name)?.element;
  }

  removeFormattingElement(element: Element, index: number = -1) { // TODO
    const node = this.formattingList.findForElement(element);
    if (node) this.formattingList.remove(node);
  }

  hasMatchInScope(test: (el: Element) => boolean, fenceTest: (el: Element) => boolean) {
    for (let i = this.openElements.length - 1; i >= 0; --i) {
      const node = this.openElements[i];
      if (test(node)) return true;
      if (fenceTest(node)) break;
    }
    return false;
  }

  isElementInScope(element: Element) {
    return this.hasMatchInScope(el => el === element, el => this.isScopeFence(el));
  }

  hasElementInScope(name: string, namespace: string = NS_HTML): boolean {
    return this.hasMatchInScope(el => el.tagName === name && el.namespaceURI === namespace, el => this.isScopeFence(el));
  }

  hasElementInListScope(name: string, namespace: string = NS_HTML): boolean {
    return this.hasMatchInScope(el => el.tagName === name && el.namespaceURI === namespace, el => this.isListScopeFence(el));
  }

  hasElementInButtonScope(name: string, namespace: string = NS_HTML): boolean {
    return this.hasMatchInScope(el => el.tagName === name && el.namespaceURI === namespace, el => this.isButtonScopeFence(el));
  }

  hasElementInTableScope(name: string, namespace: string = NS_HTML): boolean {
    return this.hasMatchInScope(el => el.tagName === name && el.namespaceURI === namespace, el => this.isTableScopeFence(el));
  }

  hasElementInSelectScope(name: string, namespace: string = NS_HTML): boolean {
    return this.hasMatchInScope(el => el.tagName === name && el.namespaceURI === namespace, el => this.isSelectScopeFence(el));
  }

  isScopeFence(element: Element): boolean {
    switch (element.namespaceURI) {
      case NS_HTML:
        switch (element.tagName) {
          case 'applet':
          case 'caption':
          case 'html':
          case 'table':
          case 'td':
          case 'th':
          case 'marquee':
          case 'object':
          case 'template':
            return true;
        }
        break;
      case NS_MATHML:
        switch (element.tagName) {
          case 'mi':
          case 'mo':
          case 'mn':
          case 'ms':
          case 'mtext':
          case 'annotation-xml':
            return true;
        }
        break;
      case NS_SVG:
        switch (element.tagName) {
          case 'foreignObject':
          case 'desc':
          case 'title':
            return true;
        }
    }
    return false;
  }

  isListScopeFence(element: Element): boolean {
    if (this.isScopeFence(element)) return true;
    // looks like next line can never happen for 'ol' or 'ul'
    // if (element.namespaceURI !== NS_HTML) return false;
    return element.tagName === 'ol' || element.tagName === 'ul';
  }

  isButtonScopeFence(element: Element): boolean {
    if (this.isScopeFence(element)) return true;
    // apparently, this method is used only for checking 'p' element inside a button
    // button CAN appear as element in non-HTML namespace
    // however, for paragraph to appear inside such a button there must be a HTML integration point or MathML integration point
    // which all of either type are scope fences
    // so, next line can never hit for 'button'
    // if (element.namespaceURI !== NS_HTML) return false;
    return element.tagName === 'button';
  }

  isTableScopeFence(element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return false;
    switch (element.tagName) {
      case 'html':
      case 'table':
      case 'template':
        return true;
      default:
        return false;
    }
  }

  isSelectScopeFence(element: Element): boolean {
    // this method is called from within 'in select' insertion mode
    // but any foreign-installing elements are forbidden in this mode
    // so next line never hits
    // if (element.namespaceURI !== NS_HTML) return true;
    return element.tagName !== 'optgroup' && element.tagName !== 'option';
  }

  isSpecial(element: Element): boolean {
    switch (element.namespaceURI) {
      case NS_HTML:
        switch (element.tagName) {
          case 'address':
          case 'applet':
          case 'area':
          case 'article':
          case 'aside':
          case 'base':
          case 'basefont':
          case 'bgsound':
          case 'blockquote':
          case 'body':
          case 'br':
          case 'button':
          case 'caption':
          case 'center':
          case 'col':
          case 'colgroup':
          case 'dd':
          case 'details':
          case 'dir':
          case 'div':
          case 'dl':
          case 'dt':
          case 'embed':
          case 'fieldset':
          case 'figcaption':
          case 'figure':
          case 'footer':
          case 'form':
          case 'frame':
          case 'frameset':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
          case 'head':
          case 'header':
          case 'hgroup':
          case 'hr':
          case 'html':
          case 'iframe':
          case 'img':
          case 'input':
          case 'keygen':
          case 'li':
          case 'link':
          case 'listing':
          case 'main':
          case 'marquee':
          case 'menu':
          case 'meta':
          case 'nav':
          case 'noembed':
          case 'noframes':
          case 'noscript':
          case 'object':
          case 'ol':
          case 'p':
          case 'param':
          case 'plaintext':
          case 'pre':
          case 'script':
          case 'search':
          case 'section':
          case 'select':
          case 'source':
          case 'style':
          case 'summary':
          case 'table':
          case 'tbody':
          case 'td':
          case 'template':
          case 'textarea':
          case 'tfoot':
          case 'th':
          case 'thead':
          case 'title':
          case 'tr':
          case 'track':
          case 'ul':
          case 'wbr':
          case 'xmp':
            return true;
          default:
            return false;
        }
      case NS_MATHML:
        switch (element.tagName) {
          case 'mi':
          case 'mo':
          case 'mn':
          case 'ms':
          case 'mtext':
          case 'annotation-xml':
            return true;
          default:
            return false;
        }
      case NS_SVG:
        switch (element.tagName) {
          case 'foreignObject':
          case 'desc':
          case 'title':
            return true;
          default:
            return false;
        }
      default:
        return false;
    }
  }

  stopParsing(): InsertionMode { // TODO
    return this.insertionMode;
  }

  adjustMathMLAttributes(token: TagToken) {
    const attributes = token.attributes;
    const len = attributes.length;
    for (let i = 0; i < len; ++i) {
      const attr = attributes[i];
      if (attr.name === 'definitionurl')
        attr.name = 'definitionURL';
    }
  }

  adjustSvgAttributes(token: TagToken) {
    const attributes = token.attributes;
    const len = attributes.length;
    for (let i = 0; i < len; ++i) {
      const attr = attributes[i];
      switch (attr.name) {
// @formatter:off
        case 'attributename': attr.name = 'attributeName'; break;
        case 'attributetype': attr.name = 'attributeType'; break;
        case 'basefrequency': attr.name = 'baseFrequency'; break;
        case 'baseprofile': attr.name = 'baseProfile'; break;
        case 'calcmode': attr.name = 'calcMode'; break;
        case 'clippathunits': attr.name = 'clipPathUnits'; break;
        case 'diffuseconstant': attr.name = 'diffuseConstant'; break;
        case 'edgemode': attr.name = 'edgeMode'; break;
        case 'filterunits': attr.name = 'filterUnits'; break;
        case 'glyphref': attr.name = 'glyphRef'; break;
        case 'gradienttransform': attr.name = 'gradientTransform'; break;
        case 'gradientunits': attr.name = 'gradientUnits'; break;
        case 'kernelmatrix': attr.name = 'kernelMatrix'; break;
        case 'kernelunitlength': attr.name = 'kernelUnitLength'; break;
        case 'keypoints': attr.name = 'keyPoints'; break;
        case 'keysplines': attr.name = 'keySplines'; break;
        case 'keytimes': attr.name = 'keyTimes'; break;
        case 'lengthadjust': attr.name = 'lengthAdjust'; break;
        case 'limitingconeangle': attr.name = 'limitingConeAngle'; break;
        case 'markerheight': attr.name = 'markerHeight'; break;
        case 'markerunits': attr.name = 'markerUnits'; break;
        case 'markerwidth': attr.name = 'markerWidth'; break;
        case 'maskcontentunits': attr.name = 'maskContentUnits'; break;
        case 'maskunits': attr.name = 'maskUnits'; break;
        case 'numoctaves': attr.name = 'numOctaves'; break;
        case 'pathlength': attr.name = 'pathLength'; break;
        case 'patterncontentunits': attr.name = 'patternContentUnits'; break;
        case 'patterntransform': attr.name = 'patternTransform'; break;
        case 'patternunits': attr.name = 'patternUnits'; break;
        case 'pointsatx': attr.name = 'pointsAtX'; break;
        case 'pointsaty': attr.name = 'pointsAtY'; break;
        case 'pointsatz': attr.name = 'pointsAtZ'; break;
        case 'preservealpha': attr.name = 'preserveAlpha'; break;
        case 'preserveaspectratio': attr.name = 'preserveAspectRatio'; break;
        case 'primitiveunits': attr.name = 'primitiveUnits'; break;
        case 'refx': attr.name = 'refX'; break;
        case 'refy': attr.name = 'refY'; break;
        case 'repeatcount': attr.name = 'repeatCount'; break;
        case 'repeatdur': attr.name = 'repeatDur'; break;
        case 'requiredextensions': attr.name = 'requiredExtensions'; break;
        case 'requiredfeatures': attr.name = 'requiredFeatures'; break;
        case 'specularconstant': attr.name = 'specularConstant'; break;
        case 'specularexponent': attr.name = 'specularExponent'; break;
        case 'spreadmethod': attr.name = 'spreadMethod'; break;
        case 'startoffset': attr.name = 'startOffset'; break;
        case 'stddeviation': attr.name = 'stdDeviation'; break;
        case 'stitchtiles': attr.name = 'stitchTiles'; break;
        case 'surfacescale': attr.name = 'surfaceScale'; break;
        case 'systemlanguage': attr.name = 'systemLanguage'; break;
        case 'tablevalues': attr.name = 'tableValues'; break;
        case 'targetx': attr.name = 'targetX'; break;
        case 'targety': attr.name = 'targetY'; break;
        case 'textlength': attr.name = 'textLength'; break;
        case 'viewbox': attr.name = 'viewBox'; break;
        case 'viewtarget': attr.name = 'viewTarget'; break;
        case 'xchannelselector': attr.name = 'xChannelSelector'; break;
        case 'ychannelselector': attr.name = 'yChannelSelector'; break;
        case 'zoomandpan': attr.name = 'zoomAndPan';
// @formatter:on
      }
    }
  }

  adjustForeignAttributes(token: TagToken) {
    const attributes = token.attributes;
    const len = attributes.length;
    for (let i = 0; i < len; ++i) {
      const attr = attributes[i];
      switch (attr.name) {
        case 'xlink:actuate':
          attributes[i] = {
            name: 'xlink:actuate',
            value: attr.value,
            prefix: 'xlink',
            localName: 'actuate',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:arcrole':
          attributes[i] = {
            name: 'xlink:arcrole',
            value: attr.value,
            prefix: 'xlink',
            localName: 'arcrole',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:href':
          attributes[i] = {
            name: 'xlink:href',
            value: attr.value,
            prefix: 'xlink',
            localName: 'href',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:role':
          attributes[i] = {
            name: 'xlink:role',
            value: attr.value,
            prefix: 'xlink',
            localName: 'role',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:show':
          attributes[i] = {
            name: 'xlink:show',
            value: attr.value,
            prefix: 'xlink',
            localName: 'show',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:title':
          attributes[i] = {
            name: 'xlink:title',
            value: attr.value,
            prefix: 'xlink',
            localName: 'title',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:type':
          attributes[i] = {
            name: 'xlink:type',
            value: attr.value,
            prefix: 'xlink',
            localName: 'type',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xml:lang':
          attributes[i] = {
            name: 'xml:lang',
            value: attr.value,
            prefix: 'xml',
            localName: 'lang',
            namespaceURI: NS_XML
          } as NamespacedAttribute;
          break;
        case 'xml:space':
          attributes[i] = {
            name: 'xml:space',
            value: attr.value,
            prefix: 'xml',
            localName: 'space',
            namespaceURI: NS_XML
          } as NamespacedAttribute;
          break;
        case 'xmlns':
          attributes[i] = {
            name: 'xmlns',
            value: attr.value,
            prefix: undefined,
            localName: 'xmlns',
            namespaceURI: NS_XMLNS
          } as NamespacedAttribute;
          break;
        case 'xmlns:xlink':
          attributes[i] = {
            name: 'xmlns:xlink',
            value: attr.value,
            prefix: 'xmlns',
            localName: 'xlink',
            namespaceURI: NS_XMLNS
          } as NamespacedAttribute;
          break;
      }
    }
  }

  adjustSvgTagName(token: TagToken) {
    switch (token.name) {
// @formatter:off
      case 'altglyph': token.name = 'altGlyph'; break;
      case 'altglyphdef': token.name = 'altGlyphDef'; break;
      case 'altglyphitem': token.name = 'altGlyphItem'; break;
      case 'animatecolor': token.name = 'animateColor'; break;
      case 'animatemotion': token.name = 'animateMotion'; break;
      case 'animatetransform': token.name = 'animateTransform'; break;
      case 'clippath': token.name = 'clipPath'; break;
      case 'feblend': token.name = 'feBlend'; break;
      case 'fecolormatrix': token.name = 'feColorMatrix'; break;
      case 'fecomponenttransfer': token.name = 'feComponentTransfer'; break;
      case 'fecomposite': token.name = 'feComposite'; break;
      case 'feconvolvematrix': token.name = 'feConvolveMatrix'; break;
      case 'fediffuselighting': token.name = 'feDiffuseLighting'; break;
      case 'fedisplacementmap': token.name = 'feDisplacementMap'; break;
      case 'fedistantlight': token.name = 'feDistantLight'; break;
      case 'fedropshadow': token.name = 'feDropShadow'; break;
      case 'feflood': token.name = 'feFlood'; break;
      case 'fefunca': token.name = 'feFuncA'; break;
      case 'fefuncb': token.name = 'feFuncB'; break;
      case 'fefuncg': token.name = 'feFuncG'; break;
      case 'fefuncr': token.name = 'feFuncR'; break;
      case 'fegaussianblur': token.name = 'feGaussianBlur'; break;
      case 'feimage': token.name = 'feImage'; break;
      case 'femerge': token.name = 'feMerge'; break;
      case 'femergenode': token.name = 'feMergeNode'; break;
      case 'femorphology': token.name = 'feMorphology'; break;
      case 'feoffset': token.name = 'feOffset'; break;
      case 'fepointlight': token.name = 'fePointLight'; break;
      case 'fespecularlighting': token.name = 'feSpecularLighting'; break;
      case 'fespotlight': token.name = 'feSpotLight'; break;
      case 'fetile': token.name = 'feTile'; break;
      case 'feturbulence': token.name = 'feTurbulence'; break;
      case 'foreignobject': token.name = 'foreignObject'; break;
      case 'glyphref': token.name = 'glyphRef'; break;
      case 'lineargradient': token.name = 'linearGradient'; break;
      case 'radialgradient': token.name = 'radialGradient'; break;
      case 'textpath': token.name = 'textPath';
// @formatter:on
    }
  }

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

  beforeHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
        // whitespace will be blocked on tokenizer level
        return this.forceHead(token);
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'startTag':
        return this.beforeHeadStartTag(token as TagToken);
      case 'endTag':
        return this.beforeHeadEndTag(token as TagToken);
      default:
        return this.forceHead(token);
    }
    return this.insertionMode;
  }

  beforeHeadStartTag(token: TagToken) {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'head':
        this.headElement = this.createAndInsertHTMLElement(token);
        return 'inHead';
      default:
        return this.forceHead(token);
    }
  }

  beforeHeadEndTag(tagToken: TagToken): InsertionMode {
    switch (tagToken.name) {
      case 'head':
      case 'body':
      case 'html':
      case 'br':
        return this.forceHead(tagToken);
      default:
        this.error('unexpected-tag-before-head');
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

  inHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
        return this.inHeadCharacters(token as CharactersToken);
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'startTag':
        return this.inHeadStartTag(token as TagToken);
      case 'endTag':
        return this.inHeadEndTag(token as TagToken);
      default:
        return this.inHeadDefault(token);
    }
    return this.insertionMode;
  }

  inHeadCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.inHeadDefault(token);
  }

  inHeadStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'title':
        return this.startTextMode('rcdata', token);
      case 'noframes':
      case 'style':
        return this.startTextMode('rawtext', token);
      case 'script':
        return this.startTextMode('scriptData', token);
      case 'noscript':
        this.createAndInsertHTMLElement(token);
        return 'inHeadNoscript';
      case 'template':
        return this.startTemplate(token);
      case 'head':
        this.error('unexpected-start-tag-in-head');
        break;
      default:
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
    }
    return this.insertionMode;
  }

  inHeadEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.popCurrentElement();
        return 'afterHead';
      case 'template':
        return this.endTemplate();
      case 'body':
      case 'html':
      case 'br':
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
      default:
        this.error('unexpected-end-tag-in-head');
    }
    return this.insertionMode;
  }

  inHeadDefault(token: Token): InsertionMode {
    this.popCurrentElement();
    return this.reprocessIn('afterHead', token);
  }

  inHeadNoscript(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inHeadNoscriptCharacters(token as CharactersToken);
      case 'startTag':
        return this.inHeadNoscriptStartTag(token as TagToken);
      case 'endTag':
        return this.inHeadNoscriptEndTag(token as TagToken);
      default:
        return this.escapeInHeadNoscript(token);
    }
    return this.insertionMode;
  }

  inHeadNoscriptStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
        // return this.inHead(token);
        this.createAndInsertEmptyHTMLElement(token);
        return this.insertionMode;
      case 'noframes':
      case 'style':
        // return this.inHead(token);
        return this.startTextMode('rawtext', token);
      case 'head':
      case 'noscript':
        this.error('unexpected-start-tag-in-head-noscript');
        return this.insertionMode;
      default:
        return this.escapeInHeadNoscript(token);
    }
  }

  inHeadNoscriptEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'noscript':
        this.popCurrentElement();
        return 'inHead';
      case 'br':
        return this.escapeInHeadNoscript(token);
      default:
        this.error('unexpected-end-tag-in-head-noscript');
    }
    return this.insertionMode;
  }

  inHeadNoscriptCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.escapeInHeadNoscript(token);
  }

  escapeInHeadNoscript(token: Token): InsertionMode {
    this.error('inappropriate-content-in-head-noscript');
    this.popCurrentElement();
    return this.reprocessIn('inHead', token);
  }

  afterHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.afterHeadCharacters(token as CharactersToken);
      case 'startTag':
        return this.afterHeadStartTag(token as TagToken);
      case 'endTag':
        return this.afterHeadEndTag(token as TagToken);
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  afterHeadCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.forceElementAndState('body', 'inBody', token);
  }

  afterHeadStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.error('unexpected-start-tag');
        break;
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'body':
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        return 'inBody';
      case 'frameset':
        this.createAndInsertHTMLElement(token);
        return 'inFrameset';
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
        this.error('head-content-after-head');
        this.pushOpenElement(this.headElement!);
        let result = this.inHead(token);
        let index = this.openElements.indexOf(this.headElement!);
        if (index === this.openElements.length - 1)
          this.popCurrentElement();
        else {
          this.openElements.splice(index, 1);
          // pushing directly and popping ensures every side-effect of removing top element
          this.openElements.push(this.headElement!);
          this.popCurrentElement();
        }
        return result;
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  afterHeadEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        // is there any well-formed case for this?
        // if no, should just shortcut to error('orphan-end-tag')
        return this.endTemplate();
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('body', 'inBody', token);
      default:
        this.error('unexpected-end-tag-after-head');
        return this.insertionMode;
    }
  }

  inBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inBodyCharacters(token as CharactersToken);
      case 'eof':
        return this.inBodyEof(token);
      case 'startTag':
        return this.inBodyStartTag(token as TagToken);
      case 'endTag':
        return this.inBodyEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  inBodyCharacters(token: CharactersToken): InsertionMode {
    this.reconstructFormattingElements();
    this.insertCharacters(token);
    this.framesetOk &&= token.whitespaceOnly;
    return this.insertionMode;
  }

  inBodyStartTag(token: TagToken): InsertionMode {
    let element: Element;
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
        // return this.inHead(token);
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'noframes':
      case 'style':
        // return this.inHead(token);
        return this.startTextMode('rawtext', token);
      case 'script':
        // return this.inHead(token);
        return this.startTextMode('scriptData', token);
      case 'template':
        // return this.inHead(token);
        return this.startTemplate(token);
      case 'title':
        // return this.inHead(token);
        return this.startTextMode('rcdata', token);
      case 'body':
        this.error('unexpected-body-start-tag');
        if (this.openElements.length > 1 && this.openElements[1].tagName === 'body' && !this.openCounts['template']) {
          this.framesetOk = false;
          this.nodeFactory.combineAttributes(this.openElements[1], token);
        }
        break;
      case 'frameset':
        this.error('frameset-in-body');
        if (this.openElements.length > 1 && this.openElements[1].tagName === 'body' && !this.openCounts['template']) {
          if (this.framesetOk) {
            this.nodeFactory.removeNode(this.openElements[1]);
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
        this.closeAnyHangingParagraph();
        this.createAndInsertHTMLElement(token);
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        this.closeAnyHangingParagraph();
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
          this.closeAnyHangingParagraph();
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
        this.closeAnyHangingParagraph();
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
        this.pushFormattingElement(this.createAndInsertHTMLElement(token), token);
        break;
      case 'nobr':
        this.reconstructFormattingElements();
        if (this.hasElementInScope('nobr')) {
          this.error('nested-nobr');
          this.adoptionAgency(token);
          this.reconstructFormattingElements();
        }
        this.pushFormattingElement(this.createAndInsertHTMLElement(token), token);
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
        this.closeAnyHangingParagraph();
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
        this.closeAnyHangingParagraph();
        this.createAndInsertEmptyHTMLElement(token);
        this.framesetOk = false;
        break;
      case 'textarea':
        this.framesetOk = false;
        return this.startTextMode('rcdata', token);
      case 'xmp':
        this.closeAnyHangingParagraph();
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
      case 'dd': // this should be handled slightly differently, but generateImpliedEndTags anyway uses exclusion
      case 'details':
      case 'dialog':
      case 'dir':
      case 'div':
      case 'dl':
      case 'dt': // this should be handled slightly differently, but generateImpliedEndTags anyway uses exclusion
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
        this.inBodyEndTagDefault(token);
        return this.insertionMode;
    }
    return this.insertionMode;
  }

  inBodyEof(token: Token) {
    if (this.templateInsertionModes.length) return this.inTemplateEof(token);
    else {
      if (this.hasExplicitlyClosableOnStack())
        this.error('abrupt-end-of-document');
      return this.stopParsing();
    }
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

  inBodyEndTagDefault(token: TagToken): void {
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
    this.closeAnyHangingParagraph();
    this.createAndInsertHTMLElement(token);
    return this.insertionMode;
  }

  inBodyStartTagHtml(token: TagToken): InsertionMode {
    this.error('unexpected-html-start-tag');
    if (!this.openCounts['template'])
      this.nodeFactory.combineAttributes(this.openElements[0], token);
    return this.insertionMode;
  }

  inBodyStartTagAnchor(token: TagToken): InsertionMode {
    let activeAnchor = this.getLastFormattingElementForName('a');
    if (activeAnchor) {
      this.error('nested-anchor');
      this.adoptionAgency(token);
      this.removeFormattingElement(activeAnchor);
      this.removeFromStack(activeAnchor);
    }
    this.reconstructFormattingElements();
    const element = this.createAndInsertHTMLElement(token);
    this.pushFormattingElement(element, token);
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

  adoptionAgency(token: TagToken) {
    // more optimization?
    const subject = token.name;
    if (subject === this.current.tagName && this.current.namespaceURI == NS_HTML && !this.isInFormattingList(this.current))
      this.popCurrentElement();
    else
      for (let outer = 0; outer < 8; ++outer) {
        let formattingElement = this.formattingList.findLatestForName(subject);
        if (!formattingElement)
          return this.inBodyEndTagDefault(token);
        let formattingPosition = this.openElements.indexOf(formattingElement.element);
        if (formattingPosition === -1) {
          this.error('formatting-element-already-closed');
          this.formattingList.remove(formattingElement);
          return;
        }
        if (!this.isElementInScope(formattingElement.element)) {
          this.error('formatting-element-out-of-scope');
          return;
        }
        if (formattingElement.element !== this.current) {
          this.error('element-closed-before-children');
        }
        let furthestPosition = formattingPosition;
        let furthestBlock: Element | undefined;
        while (++furthestPosition < this.openElements.length) {
          if (this.isSpecial(this.openElements[furthestPosition])) {
            furthestBlock = this.openElements[furthestPosition];
            break;
          }
        }
        if (!furthestBlock) {
          while (this.openElements.length > formattingPosition)
            this.popCurrentElement();
          this.formattingList.remove(formattingElement);
          return;
        }
        const commonAncestor = this.openElements[formattingPosition - 1];
        let bookmark = formattingElement.previous;
        let node = furthestBlock, lastNode = furthestBlock;
        let inner = 0;
        while (true) {
          ++inner;
          node = this.openElements[--furthestPosition];
          if (node === formattingElement.element) break;
          // TODO is it possible to shorten search by using better starting point?
          let nodeFormattingElement = this.formattingList.findForElement(node);
          if (nodeFormattingElement && inner > 3) {
            this.formattingList.remove(nodeFormattingElement);
            nodeFormattingElement = undefined;
          }
          if (!nodeFormattingElement) {
            this.removeFromStack(node);
            continue;
          }
          const replacement = this.createElementNS(nodeFormattingElement.token, NS_HTML, commonAncestor);
          nodeFormattingElement.element = replacement;
          this.openElements[furthestPosition] = replacement;
          node = replacement;
          if (lastNode === furthestBlock)
            bookmark = nodeFormattingElement;
          this.nodeFactory.relocateNode(node, lastNode);
          lastNode = node;
        }
        this.updateInsertionLocation(commonAncestor);
        this.nodeFactory.relocateNode(this.insertParent, lastNode, this.insertBefore);
        const newFormatting = this.createElementNS(formattingElement.token, NS_HTML, furthestBlock);
        this.nodeFactory.relocateChildNodes(newFormatting, furthestBlock);
        this.nodeFactory.appendElement(furthestBlock, newFormatting);
        this.formattingList.remove(formattingElement);
        this.formattingList.insertAfter(newFormatting, formattingElement.token, bookmark);
        this.openElements.splice(this.openElements.indexOf(formattingElement.element), 1);
        this.openElements.splice(this.openElements.indexOf(furthestBlock) + 1, 0, newFormatting);
      }
  }

  inTable(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inTableCharacters(token as CharactersToken);
      case 'startTag':
        return this.inTableStartTag(token as TagToken);
      case 'endTag':
        return this.inTableEndTag(token as TagToken);
      case 'eof':
        return this.inBodyEof(token);
    }
    return this.insertionMode;
  }

  inTableCharacters(token: CharactersToken) {
    const current = this.current;
    if (current.namespaceURI === NS_HTML) {
      switch (current.tagName) {
        case 'table':
        case 'tbody':
        case 'template':
        case 'tfoot':
        case 'thead':
        case 'tr':
          this.originalInsertionMode = this.insertionMode;
          return this.reprocessIn('inTableText', token);
      }
    }
    return this.inTableDefault(token);
  }

  inTableStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
        this.clearStackToTableContext();
        this.insertFormattingMarker();
        this.createAndInsertHTMLElement(token);
        return 'inCaption';
      case 'colgroup':
        this.clearStackToTableContext();
        this.createAndInsertHTMLElement(token);
        return 'inColumnGroup';
      case 'col':
        this.clearStackToTableContext();
        return this.forceElementAndState('colgroup', 'inColumnGroup', token);
      case 'tbody':
      case 'tfoot':
      case 'thead':
        this.clearStackToTableContext();
        this.createAndInsertHTMLElement(token);
        return 'inTableBody';
      case 'td':
      case 'th':
      case 'tr':
        this.clearStackToTableContext();
        return this.forceElementAndState('tbody', 'inTableBody', token);
      case 'table':
        this.error('table-in-table');
        if (this.hasElementInTableScope('table')) {
          this.popUntilName('table');
          this.resetInsertionMode();
          return this.process(token);
        }
        break;
      case 'style':
        // return this.inHead(token);
        return this.startTextMode('rawtext', token);
      case 'script':
        // return this.inHead(token);
        return this.startTextMode('scriptData', token);
      case 'template':
        return this.startTemplate(token);
      case 'input':
        const typeAttr = token.attributes.find(attr => attr.name === 'type');
        if (!typeAttr || (typeAttr.value || '').toLowerCase() !== 'hidden') {
          return this.inTableDefault(token);
        } else {
          this.error('hidden-input-in-table');
          this.createAndInsertEmptyHTMLElement(token);
        }
        break;
      case 'form':
        this.error('form-in-table');
        if (!this.openCounts['template'] && !this.formElement) {
          this.formElement = this.createAndInsertHTMLElement(token);
          this.popCurrentElement();
        }
        break;
      default:
        return this.inTableDefault(token);
    }
    return this.insertionMode;
  }

  inTableEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'table':
        if (this.hasElementInTableScope('table')) {
          this.popUntilName('table');
          this.resetInsertionMode();
        } else {
          this.error();
        }
        break;
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        this.error('unexpected-end-tag-in-table');
        break;
      case 'template':
        return this.endTemplate();
      default:
        return this.inTableDefault(token);
    }
    return this.insertionMode;
  }

  clearStackToTableContext() {
    this.popWhileMatches(this.notATableContext);
  }

  notATableContext(name: string, element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return true;
    switch (name) {
      case 'table':
      case 'template':
      case 'html':
        return false;
      default:
        return true;
    }
  }

  inTableDefault(token: Token): InsertionMode {
    if (token.type !== 'characters' && token.type !== 'cdata')
      this.error('unexpected-content-in-table');
    this.fosterParentingEnabled = true;
    const result = this.inBody(token);
    this.fosterParentingEnabled = false;
    return result;
  }

  inTableText(token: Token) {
    if (token.type === 'characters') {
      this.pendingTableCharacters.push(token as CharactersToken);
      return this.insertionMode;
    } else {
      const text = this.mergePendingCharacters();
      this.pendingTableCharacters.length = 0;
      if (text.whitespaceOnly)
        this.insertCharacters(text);
      else {
        this.error('text-in-table');
        this.inTableDefault(text);
      }
      return this.reprocessIn(this.originalInsertionMode, token);
    }
  }

  mergePendingCharacters(): CharactersToken {
    const len = this.pendingTableCharacters.length;
    if (len === 1)
      return this.pendingTableCharacters[0];
    else {
      let chunks = Array(len);
      let whitespaceOnly = true;
      for (let i = 0; i < len; ++i) {
        const textToken = this.pendingTableCharacters[i];
        chunks[i] = textToken.data;
        whitespaceOnly &&= textToken.whitespaceOnly;
      }
      return {
        type: 'characters',
        data: chunks.join(''),
        whitespaceOnly
      };
    }
  }

  inCaption(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inCaptionStartTag(token as TagToken);
      case 'endTag':
        return this.inCaptionEndTag(token as TagToken);
      default:
        return this.inBody(token);
    }
  }

  inCaptionStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        return this.inCaptionEnd(token, true);
      default:
        return this.inBodyStartTag(token);
    }
  }

  inCaptionEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
        return this.inCaptionEnd(token, false);
      case 'table':
        return this.inCaptionEnd(token, true);
      case 'body':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        this.error('unexpected-end-tag-in-caption');
        break;
      default:
        return this.inBodyEndTag(token);
    }
    return this.insertionMode;
  }
  inCaptionEnd(token: TagToken, reprocess: boolean): InsertionMode {
    if (this.hasElementInTableScope('caption')) {
      this.generateImpliedEndTags();
      if (this.current.tagName !== 'caption') {
        this.error();
        this.popUntilName('caption');
      } else
        this.popCurrentElement();
      this.clearFormattingUpToMarker();
      return reprocess ? this.reprocessIn('inTable', token) : 'inTable';
    } else
      this.error();
    return this.insertionMode;
  }

  inColumnGroup(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inColumnGroupCharacters(token as CharactersToken);
      case 'eof':
        return this.inBodyEof(token);
      case 'startTag':
        return this.inColumnGroupStartTag(token as TagToken);
      case 'endTag':
        return this.inColumnGroupEndTag(token as TagToken);
      default:
        return this.inColumnGroupDefault(token);
    }
    return this.insertionMode;
  }

  inColumnGroupCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.inColumnGroupDefault(token);
  }

  inColumnGroupStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'col':
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'template':
        return this.startTemplate(token);
      default:
        return this.inColumnGroupDefault(token);
    }
    return this.insertionMode;
  }

  inColumnGroupEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'colgroup':
        return this.inColumnGroupDefault(token, false);
      case 'col':
        this.error('void-html-element-end-tag');
        break;
      case 'template':
        return this.endTemplate();
      default:
        return this.inColumnGroupDefault(token);
    }
    return this.insertionMode;
  }

  inColumnGroupDefault(token: Token, reprocess = true): InsertionMode {
    if (this.current.tagName !== 'colgroup') {
      this.error('unexpected-content-in-column-group');
      return this.insertionMode;
    } else {
      this.popCurrentElement();
      return reprocess ? this.reprocessIn('inTable', token) : 'inTable';
    }
  }

  inTableBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inTableBodyStartTag(token as TagToken);
      case 'endTag':
        return this.inTableBodyEndTag(token as TagToken);
      default:
        return this.inTable(token);
    }
  }

  inTableBodyStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tr':
        this.clearStackToTBodyContext();
        this.createAndInsertHTMLElement(token);
        return 'inRow';
      case 'th':
      case 'td':
        this.error('table-cell-in-table-body');
        this.clearStackToTBodyContext();
        return this.forceElementAndState('tr', 'inRow', token);
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
        return this.inTableBodyEndTableBody(token);
      default:
        return this.inTable(token);
    }
  }

  inTableBodyEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tbody':
      case 'tfoot':
      case 'thead':
        if (this.hasElementInTableScope(token.name)) {
          this.clearStackToTBodyContext();
          this.popCurrentElement();
          return 'inTable';
        } else {
          this.error('wrong-table-body-end-tag');
          break;
        }
      case 'table':
        return this.inTableBodyEndTableBody(token);
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'td':
      case 'th':
      case 'tr':
        this.error('unexpected-end-tag-in-table-body');
        break;
      default:
        return this.inTable(token);
    }
    return this.insertionMode;
  }

  inTableBodyEndTableBody(token: TagToken) {
    if (this.hasMatchInScope(el => this.isTableBodyElement(el), el => this.isTableScopeFence(el))) {
      this.clearStackToTBodyContext();
      this.popCurrentElement();
      return this.reprocessIn('inTable', token);
    } else {
      this.error();
      return this.insertionMode;
    }
  }

  clearStackToTBodyContext() {
    this.popWhileMatches(this.notATBodyContext);
  }

  notATBodyContext(name: string, element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return true;
    switch (name) {
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'template':
      case 'html':
        return false;
      default:
        return true;
    }
  }

  isTableBodyElement(element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return false;
    switch (element.tagName) {
      case 'tbody':
      case 'thead':
      case 'tfoot':
        return true;
      default:
        return false;
    }
  }

  inRow(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inRowStartTag(token as TagToken);
      case 'endTag':
        return this.inRowEndTag(token as TagToken);
      default:
        return this.inTable(token);
    }
  }

  inRowStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'th':
      case 'td':
        this.clearStackToRowContext();
        this.createAndInsertHTMLElement(token);
        this.insertFormattingMarker();
        return 'inCell';
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
        return this.inRowEndRow(token, true);
      default:
        return this.inTable(token);
    }
  }

  inRowEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tr':
        return this.inRowEndRow(token, false);
      case 'table':
        return this.inRowEndRow(token, true);
      case 'tbody':
      case 'tfoot':
      case 'thead':
        if (this.hasElementInTableScope(token.name)) {
          if (this.hasElementInTableScope('tr')) {
            this.clearStackToRowContext();
            this.popCurrentElement();
            return this.reprocessIn('inTableBody', token);
          }
        } else {
          this.error('wrong-table-body-end-tag');
        }
        break;
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
      case 'td':
      case 'th':
        this.error('unexpected-end-tag-in-row');
        break;
      default:
        return this.inTable(token);
    }
    return this.insertionMode;
  }

  inRowEndRow(token: TagToken, reprocess: boolean) {
    if (this.hasElementInTableScope('tr')) {
      this.clearStackToRowContext();
      this.popCurrentElement();
      return reprocess ? this.reprocessIn('inTableBody', token) : 'inTableBody';
    } else {
      this.error();
      return this.insertionMode;
    }
  }

  clearStackToRowContext() {
    this.popWhileMatches(this.notARowContext);
  }

  notARowContext(name: string, element: Element): boolean {
    if (element.namespaceURI !== NS_HTML) return true;
    switch (name) {
      case 'tr':
      case 'template':
      case 'html':
        return false;
      default:
        return true;
    }
  }

  inCell(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inCellStartTag(token as TagToken);
      case 'endTag':
        return this.inCellEndTag(token as TagToken);
      default:
        return this.inBody(token);
    }
  }

  inCellStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        return this.closeTheCell(token);
      default:
        return this.inBodyStartTag(token);
    }
  }

  inCellEndTag(token: TagToken): InsertionMode {
    const tagName = token.name;
    switch (tagName) {
      case 'td':
      case 'th':
        if (this.hasElementInTableScope(tagName)) {
          this.generateImpliedEndTags();
          if (this.current.tagName !== tagName) {
            this.error('abrupt-end-of-cell');
            this.popUntilName(tagName);
          } else
            this.popCurrentElement();
          this.clearFormattingUpToMarker();
          return 'inRow';
        } else
          this.error('wrong-cell-end-tag');
        break;
      case 'body':
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'html':
        this.error('unexpected-end-tag-in-cell');
        break;
      case 'table':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
        if (this.hasElementInTableScope(tagName))
          return this.closeTheCell(token);
        this.error('unexpected-end-tag-in-cell');
        break;
      default:
        return this.inBodyEndTag(token);
    }
    return this.insertionMode;
  }

  closeTheCell(token: Token): InsertionMode {
    this.generateImpliedEndTags();
    const currentTagName = this.current.tagName;
    if (currentTagName !== 'td' && currentTagName !== 'th') {
      this.error();
      this.popWhileMatches((name, el) => name !== 'td' && name !== 'th' || el.namespaceURI !== NS_HTML);
    }
    this.popCurrentElement();
    this.clearFormattingUpToMarker();
    return this.reprocessIn('inRow', token);
  }

  inSelect(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        this.insertCharacters(token as CharactersToken);
        break;
      case 'startTag':
        return this.inSelectStartTag(token as TagToken);
      case 'endTag':
        return this.inSelectEndTag(token as TagToken);
      case 'eof':
        return this.inBodyEof(token);
      default:
        this.error('unexpected-content-in-select');
    }
    return this.insertionMode;
  }

  inSelectStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'option':
        if (this.current.tagName === 'option') this.popCurrentElement();
        this.createAndInsertHTMLElement(token);
        break;
      case 'optgroup':
        if (this.current.tagName === 'option') this.popCurrentElement();
        if (this.current.tagName === 'optgroup') this.popCurrentElement();
        this.createAndInsertHTMLElement(token);
        break;
      case 'hr':
        if (this.current.tagName === 'option') this.popCurrentElement();
        if (this.current.tagName === 'optgroup') this.popCurrentElement();
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'select':
        this.error('select-start-tag-in-select');
        return this.closeSelect(token, false, false);
      case 'input':
      case 'keygen':
      case 'textarea':
        this.error('input-inside-select');
        return this.closeSelect(token, true, false);
      case 'script':
        // return this.inHead(token);
        return this.startTextMode('scriptData', token);
      case 'template':
        return this.startTemplate(token);
      default:
        this.error('unexpected-content-in-select');
    }
    return this.insertionMode;
  }

  inSelectEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'optgroup':
        if (this.current.tagName === 'option') {
          const previous = this.openElements.at(-2) as Element;
          if (previous && previous.tagName === 'optgroup') {
            this.popCurrentElement();
            this.popCurrentElement();
          }
        } else if (this.current.tagName === 'optgroup')
          this.popCurrentElement();
        else
          this.error('orphan-end-tag-inside-special-element');
        break;
      case 'option':
        if (this.current.tagName === 'option')
          this.popCurrentElement();
        else
          this.error('orphan-end-tag-inside-special-element');
        break;
      case 'select':
        return this.closeSelect(token, false, true);
      case 'template':
        return this.endTemplate();
      default:
        this.error('unexpected-content-in-select');
    }
    return this.insertionMode;
  }

  closeSelect(token: TagToken, reprocess: boolean, errorIfMissing: boolean) {
    if (this.hasElementInSelectScope('select')) {
      this.popUntilName('select');
      this.resetInsertionMode();
      if (reprocess)
        return this.process(token);
    } else if (errorIfMissing)
      this.error('orphan-end-tag');
    return this.insertionMode;
  }

  inSelectInTable(token: Token): InsertionMode {
    switch (token.type) {
      case 'startTag':
        return this.inSelectInTableStartTag(token as TagToken);
      case 'endTag':
        return this.inSelectInTableEndTag(token as TagToken);
      default:
        return this.inSelect(token);
    }
  }

  inSelectInTableStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
      case 'table':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
      case 'td':
      case 'th':
        this.error('table-content-in-select-in-table');
        this.popUntilName('select');
        this.resetInsertionMode();
        return this.process(token);
      default:
        return this.inSelect(token);
    }
  }

  inSelectInTableEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
      case 'table':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
      case 'td':
      case 'th':
        this.error('table-content-in-select-in-table');
        if (this.hasElementInTableScope(token.name)) {
          this.popUntilName('select');
          this.resetInsertionMode();
          return this.process(token);
        } else
          return this.insertionMode;
      default:
        return this.inSelect(token);
    }
  }

  inTemplate(token: Token): InsertionMode {
    switch (token.type) {
      case 'characters':
        return this.inBodyCharacters(token as CharactersToken);
      case 'comment':
        // return this.inBody(token);
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        // return this.inBody(token);
        this.error('unexpected-doctype');
        break;
      case 'eof':
        return this.inTemplateEof(token);
      case 'startTag':
        return this.inTemplateStartTag(token as TagToken);
      case 'endTag':
        return this.inTemplateEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  inTemplateEof(token: Token) {
    if (this.openCounts['template']) {
      this.error('abrupt-end-of-template');
      this.popUntilName('template');
      this.clearFormattingUpToMarker();
      this.templateInsertionModes.pop();
      this.resetInsertionMode();
      return this.process(token);
    } else
      return this.stopParsing();
  }

  inTemplateStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
        // return this.inHead(token);
        this.createAndInsertEmptyHTMLElement(token);
        return this.insertionMode;
      case 'noframes':
      case 'style':
        // return this.inHead(token);
        return this.startTextMode('rawtext', token);
      case 'script':
        // return this.inHead(token);
        return this.startTextMode('scriptData', token);
      case 'title':
        // return this.inHead(token);
        return this.startTextMode('rcdata', token);
      case 'template':
        return this.startTemplate(token);
      case 'caption':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
        return this.updateTemplateModeAndReprocess('inTable', token);
      case 'col':
        return this.updateTemplateModeAndReprocess('inColumnGroup', token);
      case 'tr':
        return this.updateTemplateModeAndReprocess('inTableBody', token);
      case 'td':
      case 'th':
        return this.updateTemplateModeAndReprocess('inRow', token);
      default:
        return this.updateTemplateModeAndReprocess('inBody', token);
    }
  }

  inTemplateEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        return this.endTemplate();
      default:
        this.error('unexpected-end-tag-in-template');
        return this.insertionMode;
    }
  }

  updateTemplateModeAndReprocess(mode: InsertionMode, token: Token): InsertionMode {
    this.templateInsertionModes.pop();
    this.templateInsertionModes.push(mode);
    return this.reprocessIn(mode, token);
  }

  inFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        // non-whitespace characters are filtered on tokenizer level
        this.insertCharacters(token as CharactersToken);
        break;
      case 'eof':
        if (this.openElements.length !== 1 || this.openElements[0].tagName !== 'html')
          this.error('abrupt-end-of-frameset');
        return this.stopParsing();
      case 'startTag':
        return this.inFramesetStartTag(token as TagToken);
      case 'endTag':
        return this.inFramesetEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  inFramesetStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'frameset':
        this.createAndInsertHTMLElement(token);
        break;
      case 'frame':
        this.createAndInsertEmptyHTMLElement(token);
        break;
      case 'noframes':
        // return this.inHead(token);
        return this.startTextMode('rawtext', token);
      default:
        this.error('unexpected-content-in-frameset');
    }
    return this.insertionMode;
  }

  inFramesetEndTag(token: TagToken): InsertionMode {
    if (token.name === 'frameset') {
      if (this.openElements.length === 1 && this.openElements[0].tagName === 'html') {
        this.error('orphan-end-tag');
      } else {
        this.popCurrentElement();
        if (!this.contextElement && this.current.tagName !== 'frameset')
          return 'afterFrameset';
      }
    } else
      this.error('unexpected-content-in-frameset');
    return this.insertionMode;
  }

  afterBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken, this.openElements[0]);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.afterBodyCharacters(token as CharactersToken);
      case 'startTag':
        return this.afterBodyStartTag(token as TagToken);
      case 'endTag':
        return this.afterBodyEndTag(token as TagToken);
      case 'eof':
        return this.stopParsing();
    }
    return this.insertionMode;
  }

  afterBodyCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly)
      return this.inBodyCharacters(token);
    return this.afterBodyDefault(token);
  }

  afterBodyStartTag(token: TagToken): InsertionMode {
    if (token.name === 'html')
      return this.inBodyStartTagHtml(token);
    return this.afterBodyDefault(token);
  }

  afterBodyEndTag(token: TagToken): InsertionMode {
    if (token.name === 'html') {
      if (this.contextElement) {
        this.error('unexpected-end-tag');
        return this.insertionMode;
      }
      return 'afterAfterBody';
    }
    return this.afterBodyDefault(token);
  }

  afterBodyDefault(token: Token): InsertionMode {
    this.error('content-after-body');
    return this.reprocessIn('inBody', token);
  }

  afterFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        // non-whitespace characters are filtered on tokenizer level
        this.insertCharacters(token as CharactersToken);
        break;
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterFramesetStartTag(token as TagToken);
      case 'endTag':
        return this.afterFramesetEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  afterFramesetStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'noframes':
        // return this.inHead(token);
        return this.startTextMode('rawtext', token);
      default:
        this.error('unexpected-content-after-frameset');
    }
    return this.insertionMode;
  }

  afterFramesetEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return 'afterAfterFrameset';
      default:
        this.error('unexpected-content-after-frameset');
    }
    return this.insertionMode;
  }

  afterAfterBody(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken, this.document);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.afterAfterBodyCharacters(token as CharactersToken);
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterAfterBodyStartTag(token as TagToken);
      default:
        return this.afterAfterBodyDefault(token);
    }
    return this.insertionMode;
  }

  afterAfterBodyCharacters(token: CharactersToken) {
    if (token.whitespaceOnly)
      return this.inBodyCharacters(token);
    return this.afterAfterBodyDefault(token);
  }

  afterAfterBodyStartTag(token: TagToken): InsertionMode {
    if (token.name === 'html')
      return this.inBodyStartTagHtml(token);
    return this.afterAfterBodyDefault(token);
  }

  afterAfterBodyDefault(token: Token): InsertionMode {
    this.error('content-after-html');
    return this.reprocessIn('inBody', token);
  }

  afterAfterFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken, this.document);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
        return this.inBodyCharacters(token as CharactersToken);
      case 'eof':
        return this.stopParsing();
      case 'startTag':
        return this.afterAfterFramesetStartTag(token as TagToken);
      default:
        this.error('content-after-html');
    }
    return this.insertionMode;
  }

  afterAfterFramesetStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'noframes':
        // return this.inHead(token);
        return this.startTextMode('rawtext', token);
      default:
        this.error('content-after-html');
    }
    return this.insertionMode;
  }

  inForeignContent(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        break;
      case 'doctype':
        this.error('unexpected-doctype');
        break;
      case 'characters':
      case 'cdata':
        this.insertCharacters(token as CharactersToken);
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
        return this.inForeignContentHtmlSpecificTag(token);
      default:
        return this.inForeignContentStartTagDefault(token);
    }
  }

  inForeignContentHtmlSpecificTag(token: TagToken) {
    this.error('html-specific-tag-in-foreign-content');
    this.popWhileMatches((n, e) => !this.canContainHtml(n, e));
    return this.process(token);
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
    this.createAndInsertElementNS(token, adjustedNode.namespaceURI, token.selfClosed);
    return this.insertionMode;
  }

  inForeignContentEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'br':
      case 'p':
        return this.inForeignContentHtmlSpecificTag(token);
      default:
        if (token.name !== this.current.tagName.toLowerCase())
          this.error('unmatched-end-tag-in-foreign-content');
        for (let i = this.openElements.length - 1; i > 0; --i) {
          let node = this.openElements[i];
          if (node.namespaceURI === NS_HTML)
            return this.process(token);
          if (node.tagName.toLowerCase() === token.name) {
            while (this.openElements.length > i) {
              this.popCurrentElement();
            }
            break;
          }
        }
    }
    return this.insertionMode;
  }
  // TODO this should be static (or inlined)
  canContainHtml(name: string, element: Element): boolean {
    return element.namespaceURI === NS_HTML || this.isMathMLIntegrationPoint(element) || this.isHTMLIntegrationPoint(element);
  }
}