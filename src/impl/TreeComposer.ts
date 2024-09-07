import {CharacterData, Document, Element, Node, NodeType, ParentNode, TemplateElement} from '../interfaces/dom-types.js';
import {ErrorHandler, ignoring} from '../interfaces/ErrorHandler.js';
import {NodeFactory} from '../interfaces/NodeFactory.js';
import {FormattingList} from './FormattingList.js';
import {InsertionMode} from './interfaces/insertion-mode.js';
import {State} from './interfaces/states.js';
import {CharactersToken, CommentToken, DoctypeToken, NamespacedAttribute, TagToken, Token, TokenType} from './interfaces/tokens.js';
import {ComposerIntegration, Tokenizer} from './Tokenizer.js';

export const NS_HTML = 'http://www.w3.org/1999/xhtml';
export const NS_MATHML = 'http://www.w3.org/1998/Math/MathML';
export const NS_SVG = 'http://www.w3.org/2000/svg';
export const NS_XLINK = 'http://www.w3.org/1999/xlink';
export const NS_XML = 'http://www.w3.org/XML/1998/namespace';
export const NS_XMLNS = 'http://www.w3.org/2000/xmlns/';

export class TreeComposer implements ComposerIntegration {
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

  errorHandler: ErrorHandler;

  constructor(nodeFactory: NodeFactory, errorHandler: ErrorHandler = ignoring) {
    this.nodeFactory = nodeFactory;
    this.errorHandler = errorHandler;
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
      this.tokenizer.state = State.DATA;
      this.setInsertionMode(InsertionMode.INITIAL);
    } else
      this.resetForFragmentCase(contextElement!);
  }

  resetForFragmentCase(contextElement: Element) {
    switch (contextElement.tagName) {
      case 'title':
      case 'textarea':
        this.tokenizer.state = State.RCDATA;
        break;
      case 'style':
      case 'xmp':
      case 'iframe':
      case 'noembed':
      case 'noframes':
        this.tokenizer.state = State.RAWTEXT;
        break;
      case 'script':
        this.tokenizer.state = State.SCRIPT_DATA;
        break;
      case 'plaintext':
        this.tokenizer.state = State.PLAINTEXT;
        break;
      default:
        this.tokenizer.state = State.DATA;
    }
    const root = this.createElementNS({type: TokenType.START_TAG, name: 'html', selfClosed: false, attributes: []}, NS_HTML, this.document);
    this.pushOpenElement(root);
    if (contextElement.tagName === 'template')
      this.templateInsertionModes.push(InsertionMode.IN_TEMPLATE);
    this.resetInsertionMode();
    for (let el: Element | null = contextElement; el; el = el.parentElement)
      if (el.tagName === 'form') {
        this.formElement = el;
        break;
      }
  }

  accept(token: Token) {
    if (token.type !== TokenType.EOF && this.shouldUseForeignRules(token))
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
      if (token.type === TokenType.CHARACTERS) return false;
      if (token.type === TokenType.START_TAG && (token as TagToken).name !== 'mglyph' && (token as TagToken).name !== 'malignmark') return false;
    }
    if (adjustedNode.namespaceURI === NS_MATHML && adjustedNode.tagName === 'annotation-xml') {
      if (token.type === TokenType.START_TAG && (token as TagToken).name === 'svg') return false;
    }
    if (this.isHTMLIntegrationPoint(adjustedNode)) {
      if (token.type === TokenType.CHARACTERS || token.type === TokenType.START_TAG) return false;
    }
    return true;
  }

  process(token: Token): InsertionMode {
    switch (this.insertionMode) {
//@formatter:off
      case InsertionMode.INITIAL: return this.initial(token);
      case InsertionMode.BEFORE_HTML: return this.beforeHtml(token);
      case InsertionMode.BEFORE_HEAD: return this.beforeHead(token);
      case InsertionMode.IN_HEAD: return this.inHead(token);
      case InsertionMode.IN_HEAD_NOSCRIPT: return this.inHeadNoscript(token);
      case InsertionMode.AFTER_HEAD: return this.afterHead(token);
      case InsertionMode.IN_BODY: return this.inBody(token);
      case InsertionMode.TEXT: return this.text(token);
      case InsertionMode.IN_TABLE: return this.inTable(token);
      case InsertionMode.IN_TABLE_TEXT: return this.inTableText(token);
      case InsertionMode.IN_CAPTION: return this.inCaption(token);
      case InsertionMode.IN_COLUMN_GROUP: return this.inColumnGroup(token);
      case InsertionMode.IN_TABLE_BODY: return this.inTableBody(token);
      case InsertionMode.IN_ROW: return this.inRow(token);
      case InsertionMode.IN_CELL: return this.inCell(token);
      case InsertionMode.IN_SELECT: return this.inSelect(token);
      case InsertionMode.IN_SELECT_IN_TABLE: return this.inSelectInTable(token);
      case InsertionMode.IN_TEMPLATE: return this.inTemplate(token);
      case InsertionMode.AFTER_BODY: return this.afterBody(token);
      case InsertionMode.IN_FRAMESET: return this.inFrameset(token);
      case InsertionMode.AFTER_FRAMESET: return this.afterFrameset(token);
      case InsertionMode.AFTER_AFTER_BODY: return this.afterAfterBody(token);
      case InsertionMode.AFTER_AFTER_FRAMESET: return this.afterAfterFrameset(token);
//@formatter:on
    }
  }

  reprocessIn(mode: InsertionMode, token: Token): InsertionMode {
    this.setInsertionMode(mode);
    return this.process(token);
  }

  setInsertionMode(value: InsertionMode) {
    if (this.insertionMode === value) return;
    switch (this.insertionMode = value) {
      case InsertionMode.INITIAL:
      case InsertionMode.BEFORE_HTML:
      case InsertionMode.BEFORE_HEAD:
        return this.tokenizer.whitespaceMode = 'ignoreLeading';
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NOSCRIPT:
      case InsertionMode.AFTER_HEAD:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.AFTER_BODY:
      case InsertionMode.AFTER_AFTER_BODY:
        return this.tokenizer.whitespaceMode = 'emitLeading';
      case InsertionMode.IN_BODY:
      case InsertionMode.TEXT:
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_TEXT:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE:
      case InsertionMode.IN_TEMPLATE:
        return this.tokenizer.whitespaceMode = 'mixed';
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET:
      case InsertionMode.AFTER_AFTER_FRAMESET:
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
                return InsertionMode.IN_SELECT_IN_TABLE;
              case 'template':
                return InsertionMode.IN_SELECT;
            }
          }
          return InsertionMode.IN_SELECT;
        case 'td':
        case 'th':
          return i === 0 ? /* fragment case */ InsertionMode.IN_BODY : InsertionMode.IN_CELL;
        case 'tr':
          return InsertionMode.IN_ROW;
        case 'tbody':
        case 'thead':
        case 'tfoot':
          return InsertionMode.IN_TABLE_BODY;
        case 'caption':
          return InsertionMode.IN_CAPTION;
        case 'colgroup':
          return InsertionMode.IN_COLUMN_GROUP;
        case 'table':
          return InsertionMode.IN_TABLE;
        case 'template':
          return this.templateInsertionModes.at(-1)!;
        case 'head':
          return InsertionMode.IN_HEAD;
        case 'body':
          return InsertionMode.IN_BODY;
        case 'frameset': // fragment case
          return InsertionMode.IN_FRAMESET;
        case 'html':
          return this.headElement ? InsertionMode.AFTER_HEAD : /* fragment case */InsertionMode.BEFORE_HEAD;
        default: // fragment case
          if (i === 0) return InsertionMode.IN_BODY;
      }
    }
  }

  text(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.CHARACTERS:
      case TokenType.CDATA:
        this.insertCharacters(token as CharactersToken);
        break;
      case TokenType.EOF:
        this.error('abrupt-end-of-text');
        this.popCurrentElement();
        return this.reprocessIn(this.originalInsertionMode, token);
      case TokenType.END_TAG:
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
    this.nodeFactory.setDoctype(this.document, documentType);
  }

  insertComment(token: CommentToken, override?: ParentNode) {
    this.updateInsertionLocation(override);
    this.insertNodeAtCurrentLocation(this.nodeFactory.createComment(this.insertParent, token.data));
  }

  insertCharacters(token: CharactersToken) {
    this.updateInsertionLocation();
    if (this.insertParent.nodeType !== NodeType.DOCUMENT_NODE) {
      let node: CharacterData;
      switch (token.type) {
        case TokenType.CHARACTERS:
          node = this.nodeFactory.createText(this.insertParent, token.data);
          break;
        case TokenType.CDATA:
          node = this.nodeFactory.createCData(this.insertParent, token.data);
      }
      this.insertNodeAtCurrentLocation(node);
    }
  }

  generateImpliedEndTags(exclude?: string) {
    const stack = this.openElements;
    let i = stack.length;
    while (true) {
      const element = stack[--i];
      // for every case when this method is called there should be some HTML element in the scope
      // and this method never proceeds beyond that element, so any foreign element is impossible here
      // if (element.namespaceURI !== NS_HTML) return;
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
    let i = stack.length;
    while (true) {
      const element = stack[--i];
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
      type: TokenType.START_TAG,
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
      switch ((target as Element).tagName) {
        case 'table':
        case 'tbody':
        case 'tfoot':
        case 'thead':
        case 'tr':
          let lastTemplateIndex = this.openElements.findLastIndex(el => el.tagName === 'template' && el.namespaceURI === NS_HTML);
          let lastTableIndex = this.openElements.findLastIndex(el => el.tagName === 'table' && el.namespaceURI === NS_HTML);
          if (lastTemplateIndex >= 0 && (lastTableIndex < 0 || lastTemplateIndex > lastTableIndex)) {
            this.insertParent = (this.openElements[lastTemplateIndex] as TemplateElement).content;
            return;
          } else if (lastTableIndex < 0) { // fragment case
            this.insertParent = this.openElements[0];
            return;
          } else {
            this.insertParent = (this.insertBefore = this.openElements[lastTableIndex]).parentNode!;
            return;
          }
      }
    }
    if ((this.insertParent as Element).localName === 'template' && (this.insertParent as Element).namespaceURI === NS_HTML) {
      this.insertParent = (this.insertParent as TemplateElement).content;
    }
  }

  insertNodeAtCurrentLocation(node: Node) {
    if (!this.insertBefore)
      this.nodeFactory.appendNode(this.insertParent, node);
    else
      this.nodeFactory.insertNode(this.insertBefore, node);
  }

  insertElementAtCurrentLocation(element: Element) {
    if (!this.insertBefore)
      this.nodeFactory.appendElement(this.insertParent, element);
    else
      this.nodeFactory.insertElement(this.insertBefore, element);
  }

  /** a-ka "insert a foreign element" */
  createAndInsertElementNS(token: TagToken, namespace: string | null, popImmediately: boolean
                           // adding the element only to stack can only happen for shadow root hosts, so skip it for now
                           //, onlyAddToStack: boolean = false
  ): Element {
    this.updateInsertionLocation();
    if (!popImmediately && token.selfClosed)
      this.error('non-void-html-element-start-tag-with-trailing-solidus');
    let element = this.createElementNS(token, namespace, this.insertParent);
    //if (!onlyAddToStack)
    this.insertElementAtCurrentLocation(element);
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

  createAndInsertHtmlTemplate(token: TagToken): TemplateElement {
    if (token.selfClosed)
      this.error('non-void-html-element-start-tag-with-trailing-solidus');
    this.updateInsertionLocation();
    const element = this.nodeFactory.createTemplateElement(this.insertParent, token, NS_HTML);
    this.validateNsAttributes(element);
    this.insertElementAtCurrentLocation(element);
    this.pushOpenElement(element);
    return element;
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
    for (let i = stack.length - 1; ; --i) {
      const element = stack[i];
      const name = element.tagName;
      if (test(name, element))
        this.popCurrentElement();
      else break;
    }
  }

  popUntilNameHtml(name: string) {
    const stack = this.openElements;
    for (let i = stack.length - 1; ; --i) {
      const element = stack[i];
      this.popCurrentElement();
      if (name === element.tagName && element.namespaceURI === NS_HTML) break;
    }
  }

  removeFromStack(element: Element) {
    let index = this.openElements.indexOf(element);
    if (index >= 0) {
      if (index === this.openElements.length - 1)
        this.popCurrentElement();
      else {
        this.openElements.splice(index, 1);
        this.openCounts[element.tagName]--;
      }
    }
  }

  startTextMode(tokenizerState: State, token: TagToken): InsertionMode {
    this.createAndInsertHTMLElement(token);
    this.originalInsertionMode = this.insertionMode;
    this.tokenizer.state = tokenizerState;
    this.tokenizer.lastOpenTag = token.name;
    return InsertionMode.TEXT;
  }

  startTemplate(token: TagToken): InsertionMode {
    this.formattingList.addMarker();
    this.framesetOk = false;
    this.templateInsertionModes.push(InsertionMode.IN_TEMPLATE);
    this.createAndInsertHtmlTemplate(token);
    return InsertionMode.IN_TEMPLATE;
  }

  endTemplate(): InsertionMode {
    if (this.openCounts['template']) {
      this.generateImpliedEndTagsThoroughly();
      let current = this.current;
      if (current.tagName !== 'template' || current.namespaceURI !== NS_HTML) {
        this.error('abrupt-end-of-template');
        this.popUntilNameHtml('template');
      } else
        this.popCurrentElement();
      this.formattingList.clearToMarker();
      this.templateInsertionModes.pop();
      this.resetInsertionMode();
    } else
      this.error('orphan-end-tag');
    return this.insertionMode;
  }

  error(error: string = 'error') { // TODO give names to all errors
    this.errorHandler(error);
  }

  forceCloseElement(name: string) {
    this.generateImpliedEndTags(name);
    if (this.current.tagName !== name || this.current.namespaceURI !== NS_HTML) {
      this.error('element-closed-before-children');
      this.popUntilNameHtml(name);
    } else
      this.popCurrentElement();
  }

  closeAnyHangingParagraph() {
    if (this.hasElementInButtonScope('p'))
      this.forceCloseElement('p');
  }

  reconstructFormattingElements() {
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

  hasMatchInScope(test: (el: Element) => boolean, fenceTest: (el: Element) => boolean) {
    for (let i = this.openElements.length - 1; i >= 0; --i) {
      const node = this.openElements[i];
      if (test(node)) return true;
      if (fenceTest(node)) break;
    }
    return false;
  }

  hasNamedHtmlMatchInScope(name: string, fenceTest: (el: Element) => boolean) {
    for (let i = this.openElements.length - 1; i >= 0; --i) {
      const node = this.openElements[i];
      if (node.tagName === name && node.namespaceURI === NS_HTML) return true;
      if (fenceTest(node)) break;
    }
    return false;
  }

  isElementInScope(element: Element) {
    for (let i = this.openElements.length - 1; ; --i) {
      const node = this.openElements[i];
      if (node === element) return true;
      if (this.isScopeFence(node)) break;
    }
    return false;
  }

  hasElementInScope(name: string): boolean {
    return this.hasNamedHtmlMatchInScope(name, this.isScopeFence);
  }

  hasElementInListScope(name: string): boolean {
    return this.hasNamedHtmlMatchInScope(name, el => this.isListScopeFence(el));
  }

  hasElementInButtonScope(name: string): boolean {
    return this.hasNamedHtmlMatchInScope(name, el => this.isButtonScopeFence(el));
  }

  hasElementInTableScope(name: string): boolean {
    return this.hasNamedHtmlMatchInScope(name, this.isTableScopeFence);
  }

  hasElementInSelectScope(name: string): boolean {
    return this.hasNamedHtmlMatchInScope(name, this.isSelectScopeFence);
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
          case 'desc':
          case 'foreignObject':
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
      case 'html': // fragment case
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
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        return InsertionMode.INITIAL;
      case TokenType.DOCTYPE:
        this.insertDoctype(token as DoctypeToken);
        // TODO set doctype of current document
        return InsertionMode.BEFORE_HTML;
      default:
        //whitespace is ignored on tokenizer level
        this.error('missing-doctype');
        return this.reprocessIn(InsertionMode.BEFORE_HTML, token);
    }
  }

  beforeHtml(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        return InsertionMode.BEFORE_HTML;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        return InsertionMode.BEFORE_HTML;
      case TokenType.START_TAG:
        return this.beforeHtmlStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.beforeHtmlEndTag(token as TagToken);
      default:
        //whitespace is ignored on tokenizer level
        return this.forceElementAndState('html', InsertionMode.BEFORE_HEAD, token);
    }
  }

  beforeHtmlStartTag(token: TagToken): InsertionMode {
    if (token.name === 'html') {
      this.createAndInsertHTMLElement(token);
      return InsertionMode.BEFORE_HEAD;
    }
    return this.forceElementAndState('html', InsertionMode.BEFORE_HEAD, token);
  }

  beforeHtmlEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('html', InsertionMode.BEFORE_HEAD, token);
      default:
        this.error('unexpected-tag-before-html');
        return InsertionMode.BEFORE_HTML;
    }
  }

  beforeHead(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.CHARACTERS:
        // whitespace will be blocked on tokenizer level
        return this.forceHead(token);
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.START_TAG:
        return this.beforeHeadStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.beforeHeadEndTag(token as TagToken);
      default:
        return this.forceHead(token);
    }
    return this.insertionMode;
  }

  beforeHeadStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBodyStartTagHtml(token);
      case 'head':
        this.headElement = this.createAndInsertHTMLElement(token);
        return InsertionMode.IN_HEAD;
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
      type: TokenType.START_TAG,
      name: 'head',
      selfClosed: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn(InsertionMode.IN_HEAD, token);
  }

  inHead(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.CHARACTERS:
        return this.inHeadCharacters(token as CharactersToken);
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.START_TAG:
        return this.inHeadStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        return this.startTextMode(State.RCDATA, token);
      case 'noframes':
      case 'style':
        return this.startTextMode(State.RAWTEXT, token);
      case 'script':
        return this.startTextMode(State.SCRIPT_DATA, token);
      case 'noscript':
        this.createAndInsertHTMLElement(token);
        return InsertionMode.IN_HEAD_NOSCRIPT;
      case 'template':
        return this.startTemplate(token);
      case 'head':
        this.error('unexpected-start-tag-in-head');
        break;
      default:
        this.popCurrentElement();
        return this.reprocessIn(InsertionMode.AFTER_HEAD, token);
    }
    return this.insertionMode;
  }

  inHeadEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.popCurrentElement();
        return InsertionMode.AFTER_HEAD;
      case 'template':
        return this.endTemplate();
      case 'body':
      case 'html':
      case 'br':
        this.popCurrentElement();
        return this.reprocessIn(InsertionMode.AFTER_HEAD, token);
      default:
        this.error('unexpected-end-tag-in-head');
    }
    return this.insertionMode;
  }

  inHeadDefault(token: Token): InsertionMode {
    this.popCurrentElement();
    return this.reprocessIn(InsertionMode.AFTER_HEAD, token);
  }

  inHeadNoscript(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.inHeadNoscriptCharacters(token as CharactersToken);
      case TokenType.START_TAG:
        return this.inHeadNoscriptStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        return this.startTextMode(State.RAWTEXT, token);
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
        return InsertionMode.IN_HEAD;
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
    return this.reprocessIn(InsertionMode.IN_HEAD, token);
  }

  afterHead(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.afterHeadCharacters(token as CharactersToken);
      case TokenType.START_TAG:
        return this.afterHeadStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.afterHeadEndTag(token as TagToken);
      default:
        return this.forceElementAndState('body', InsertionMode.IN_BODY, token);
    }
    return this.insertionMode;
  }

  afterHeadCharacters(token: CharactersToken): InsertionMode {
    if (token.whitespaceOnly) {
      this.insertCharacters(token);
      return this.insertionMode;
    }
    return this.forceElementAndState('body', InsertionMode.IN_BODY, token);
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
        return InsertionMode.IN_BODY;
      case 'frameset':
        this.createAndInsertHTMLElement(token);
        return InsertionMode.IN_FRAMESET;
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
        this.removeFromStack(this.headElement!);
        return result;
      default:
        return this.forceElementAndState('body', InsertionMode.IN_BODY, token);
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
        return this.forceElementAndState('body', InsertionMode.IN_BODY, token);
      default:
        this.error('unexpected-end-tag-after-head');
        return this.insertionMode;
    }
  }

  inBody(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.inBodyCharacters(token as CharactersToken);
      case TokenType.EOF:
        return this.inBodyEof(token);
      case TokenType.START_TAG:
        return this.inBodyStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        return this.startTextMode(State.RAWTEXT, token);
      case 'script':
        // return this.inHead(token);
        return this.startTextMode(State.SCRIPT_DATA, token);
      case 'template':
        // return this.inHead(token);
        return this.startTemplate(token);
      case 'title':
        // return this.inHead(token);
        return this.startTextMode(State.RCDATA, token);
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
            return InsertionMode.IN_FRAMESET;
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
        if (this.isHeadingElement(this.current)) {
          this.error('immediately-nested-heading-start-tag');
          this.popCurrentElement();
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
        this.tokenizer.state = State.PLAINTEXT;
        break;
      case 'button':
        if (this.hasElementInScope('button')) {
          this.error('nested-button');
          // https://github.com/whatwg/html/issues/10476
          // this.generateImpliedEndTags();
          this.popUntilNameHtml('button');
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
        this.formattingList.add(this.createAndInsertHTMLElement(token), token);
        break;
      case 'nobr':
        this.reconstructFormattingElements();
        if (this.hasElementInScope('nobr')) {
          this.error('nested-nobr');
          this.adoptionAgency(token);
          this.reconstructFormattingElements();
        }
        this.formattingList.add(this.createAndInsertHTMLElement(token), token);
        break;
      case 'applet':
      case 'marquee':
      case 'object':
        this.reconstructFormattingElements();
        this.createAndInsertHTMLElement(token);
        this.formattingList.addMarker();
        this.framesetOk = false;
        break;
      case 'table':
        this.closeAnyHangingParagraph();
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        return InsertionMode.IN_TABLE;
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
        return this.startTextMode(State.RCDATA, token);
      case 'xmp':
        this.closeAnyHangingParagraph();
        this.reconstructFormattingElements();
      case 'iframe': // ok no break
        this.framesetOk = false;
      case 'noembed': // ok no break
        return this.startTextMode(State.RAWTEXT, token);
      case 'select':
        this.reconstructFormattingElements();
        this.createAndInsertHTMLElement(token);
        this.framesetOk = false;
        switch (this.insertionMode) {
          case InsertionMode.IN_TABLE:
          case InsertionMode.IN_CAPTION:
          case InsertionMode.IN_TABLE_BODY:
          case InsertionMode.IN_ROW:
          case InsertionMode.IN_CELL:
            return InsertionMode.IN_SELECT_IN_TABLE;
          default:
            return InsertionMode.IN_SELECT;
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
        this.createAndInsertElementNS(token, NS_MATHML, token.selfClosed);
        break;
      case 'svg':
        this.reconstructFormattingElements();
        this.adjustSvgAttributes(token);
        this.adjustForeignAttributes(token);
        this.createAndInsertElementNS(token, NS_SVG, token.selfClosed);
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
        if (this.hasElementInScope('body')) {
          if (this.hasExplicitlyClosableOnStack())
            this.error('abrupt-end-of-content');
          return token.name === 'body' ? InsertionMode.AFTER_BODY : this.reprocessIn(InsertionMode.AFTER_BODY, token);
        }
        this.error('orphan-end-tag');
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
          this.createAndInsertHTMLElement({type: TokenType.START_TAG, name: 'p', selfClosed: false, attributes: []});
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
        if (this.hasMatchInScope(this.isHeadingElement, this.isScopeFence)) {
          this.generateImpliedEndTags();
          if (this.current.tagName !== token.name || this.current.namespaceURI !== NS_HTML) {
            this.error('incorrectly-closed-heading-element');
            this.popWhileMatches((name, el) => !this.isHeadingElement(el));
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
          this.formattingList.clearToMarker();
        } else
          this.error('orphan-end-tag');
        break;
      case 'br':
        this.error('br-end-tag');
        return this.inBodyStartTag({type: TokenType.START_TAG, name: 'br', selfClosed: false, attributes: []});
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

  isHeadingElement(element: Element) {
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
    let activeFormatting = this.formattingList.findLatestForName('a');
    if (activeFormatting) {
      const activeAnchor = activeFormatting.element;
      this.error('nested-anchor');
      this.adoptionAgency(token);
      if (activeFormatting.fastKey) { // the formatting node was not removed
        this.formattingList.remove(activeFormatting);
        this.removeFromStack(activeAnchor);
      }
      this.removeFromStack(activeAnchor);
    }
    this.reconstructFormattingElements();
    this.formattingList.add(this.createAndInsertHTMLElement(token), token);
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
    if (subject === this.current.tagName && this.current.namespaceURI == NS_HTML && !this.formattingList.findForElement(this.current))
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
        const newFormattingElement = this.createElementNS(formattingElement.token, NS_HTML, furthestBlock);
        this.nodeFactory.relocateChildNodes(newFormattingElement, furthestBlock);
        this.nodeFactory.appendElement(furthestBlock, newFormattingElement);
        this.formattingList.remove(formattingElement);
        this.formattingList.insertAfter(newFormattingElement, formattingElement.token, bookmark);
        // remove from stack and re-insert its copy back - no need to update openCounts
        this.openElements.splice(this.openElements.indexOf(formattingElement.element), 1);
        this.openElements.splice(this.openElements.indexOf(furthestBlock) + 1, 0, newFormattingElement);
      }
  }

  inTable(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.inTableCharacters(token as CharactersToken);
      case TokenType.START_TAG:
        return this.inTableStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.inTableEndTag(token as TagToken);
      case TokenType.EOF:
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
          return this.reprocessIn(InsertionMode.IN_TABLE_TEXT, token);
      }
    }
    return this.inTableDefault(token);
  }

  inTableStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
        this.popWhileMatches(this.notATableContext);
        this.formattingList.addMarker();
        this.createAndInsertHTMLElement(token);
        return InsertionMode.IN_CAPTION;
      case 'colgroup':
        this.popWhileMatches(this.notATableContext);
        this.createAndInsertHTMLElement(token);
        return InsertionMode.IN_COLUMN_GROUP;
      case 'col':
        this.popWhileMatches(this.notATableContext);
        return this.forceElementAndState('colgroup', InsertionMode.IN_COLUMN_GROUP, token);
      case 'tbody':
      case 'tfoot':
      case 'thead':
        this.popWhileMatches(this.notATableContext);
        this.createAndInsertHTMLElement(token);
        return InsertionMode.IN_TABLE_BODY;
      case 'td':
      case 'th':
      case 'tr':
        this.popWhileMatches(this.notATableContext);
        return this.forceElementAndState('tbody', InsertionMode.IN_TABLE_BODY, token);
      case 'table':
        this.error('table-in-table');
        if (this.hasElementInTableScope('table')) {
          this.popUntilNameHtml('table');
          this.resetInsertionMode();
          return this.process(token);
        }
        break; // fragment case
      case 'style':
        // return this.inHead(token);
        return this.startTextMode(State.RAWTEXT, token);
      case 'script':
        // return this.inHead(token);
        return this.startTextMode(State.SCRIPT_DATA, token);
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
          this.popUntilNameHtml('table');
          this.resetInsertionMode();
        } else { // fragment case
          this.error('orphan-end-tag');
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
    if (token.type !== TokenType.CHARACTERS && token.type !== TokenType.CDATA)
      this.error('unexpected-content-in-table');
    this.fosterParentingEnabled = true;
    const result = this.inBody(token);
    this.fosterParentingEnabled = false;
    return result;
  }

  inTableText(token: Token) {
    if (token.type === TokenType.CHARACTERS) {
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
        type: TokenType.CHARACTERS,
        data: chunks.join(''),
        whitespaceOnly
      };
    }
  }

  inCaption(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.START_TAG:
        return this.inCaptionStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        return this.inCaptionEnd(token, true, 'unexpected-start-tag');
      default:
        return this.inBodyStartTag(token);
    }
  }

  inCaptionEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'caption':
        return this.inCaptionEnd(token, false, 'orphan-end-tag');
      case 'table':
        return this.inCaptionEnd(token, true, 'orphan-end-tag');
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

  inCaptionEnd(token: TagToken, reprocess: boolean, error: string): InsertionMode {
    if (this.hasElementInTableScope('caption')) {
      this.forceCloseElement('caption');
      this.formattingList.clearToMarker();
      return reprocess ? this.reprocessIn(InsertionMode.IN_TABLE, token) : InsertionMode.IN_TABLE;
    } else { // fragment case
      this.error(error);
      return this.insertionMode;
    }
  }

  inColumnGroup(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.inColumnGroupCharacters(token as CharactersToken);
      case TokenType.EOF:
        return this.inBodyEof(token);
      case TokenType.START_TAG:
        return this.inColumnGroupStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.inColumnGroupEndTag(token as TagToken);
        // CDATA is impossible here
        // default: return this.inColumnGroupDefault(token);
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
      return reprocess ? this.reprocessIn(InsertionMode.IN_TABLE, token) : InsertionMode.IN_TABLE;
    }
  }

  inTableBody(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.START_TAG:
        return this.inTableBodyStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.inTableBodyEndTag(token as TagToken);
      default:
        return this.inTable(token);
    }
  }

  inTableBodyStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tr':
        this.popWhileMatches(this.notATBodyContext);
        this.createAndInsertHTMLElement(token);
        return InsertionMode.IN_ROW;
      case 'th':
      case 'td':
        this.error('table-cell-in-table-body');
        this.popWhileMatches(this.notATBodyContext);
        return this.forceElementAndState('tr', InsertionMode.IN_ROW, token);
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
        return this.inTableBodyEndTableBody(token, 'unexpected-start-tag');
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
          this.popWhileMatches(this.notATBodyContext);
          this.popCurrentElement();
          return InsertionMode.IN_TABLE;
        } else {
          this.error('wrong-table-body-end-tag');
          break;
        }
      case 'table':
        return this.inTableBodyEndTableBody(token, 'orphan-end-tag');
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

  inTableBodyEndTableBody(token: TagToken, error: string) {
    if (this.hasMatchInScope(this.isTableBodyElement, this.isTableScopeFence)) {
      this.popWhileMatches(this.notATBodyContext);
      this.popCurrentElement();
      return this.reprocessIn(InsertionMode.IN_TABLE, token);
    } else { // fragment case
      this.error(error);
      return this.insertionMode;
    }
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
      case TokenType.START_TAG:
        return this.inRowStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.inRowEndTag(token as TagToken);
      default:
        return this.inTable(token);
    }
  }

  inRowStartTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'th':
      case 'td':
        this.popWhileMatches(this.notARowContext);
        this.createAndInsertHTMLElement(token);
        this.formattingList.addMarker();
        return InsertionMode.IN_CELL;
      case 'caption':
      case 'col':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
      case 'tr':
        if (this.hasElementInTableScope('tr')) {
          this.popWhileMatches(this.notARowContext);
          this.popCurrentElement();
          return this.reprocessIn(InsertionMode.IN_TABLE_BODY, token);
        } else { // fragment case
          this.error('unexpected-start-tag');
          return this.insertionMode;
        }
      default:
        return this.inTable(token);
    }
  }

  inRowEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'tr':
        if (this.hasElementInTableScope('tr')) {
          this.popWhileMatches(this.notARowContext);
          this.popCurrentElement();
          return InsertionMode.IN_TABLE_BODY;
        } else // fragment case
          this.error('orphan-end-tag');
        break;
      case 'table':
        if (this.hasElementInTableScope('tr')) {
          this.popWhileMatches(this.notARowContext);
          this.popCurrentElement();
          return this.reprocessIn(InsertionMode.IN_TABLE_BODY, token);
        } else // fragment case
          this.error('unexpected-end-tag');
        break;
      case 'tbody':
      case 'tfoot':
      case 'thead':
        if (this.hasElementInTableScope(token.name)) {
          if (this.hasElementInTableScope('tr')) {
            this.popWhileMatches(this.notARowContext);
            this.popCurrentElement();
            return this.reprocessIn(InsertionMode.IN_TABLE_BODY, token);
          }
        } else
          this.error('unexpected-end-tag');
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
      case TokenType.START_TAG:
        return this.inCellStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        return this.closeCell(token);
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
            this.popUntilNameHtml(tagName);
          } else
            this.popCurrentElement();
          this.formattingList.clearToMarker();
          return InsertionMode.IN_ROW;
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
          return this.closeCell(token);
        this.error('unexpected-end-tag-in-cell');
        break;
      default:
        return this.inBodyEndTag(token);
    }
    return this.insertionMode;
  }

  closeCell(token: Token): InsertionMode {
    this.generateImpliedEndTags();
    const currentTagName = this.current.tagName;
    if (currentTagName !== 'td' && currentTagName !== 'th' || this.current.namespaceURI !== NS_HTML) {
      this.error('abrupt-end-of-cell');
      this.popWhileMatches((name, el) => name !== 'td' && name !== 'th' || el.namespaceURI !== NS_HTML);
    }
    this.popCurrentElement();
    this.formattingList.clearToMarker();
    return this.reprocessIn(InsertionMode.IN_ROW, token);
  }

  inSelect(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        this.insertCharacters(token as CharactersToken);
        break;
      case TokenType.START_TAG:
        return this.inSelectStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.inSelectEndTag(token as TagToken);
      case TokenType.EOF:
        return this.inBodyEof(token);
        // CDATA is impossible here
        // default: this.error('unexpected-content-in-select');
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
        return this.startTextMode(State.SCRIPT_DATA, token);
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
      this.popUntilNameHtml('select');
      this.resetInsertionMode();
      if (reprocess)
        return this.process(token);
    } else if (errorIfMissing) // fragment case
      this.error('orphan-end-tag');
    return this.insertionMode;
  }

  inSelectInTable(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.START_TAG:
        return this.inSelectInTableStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        this.popUntilNameHtml('select');
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
          this.popUntilNameHtml('select');
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
      case TokenType.CHARACTERS:
        return this.inBodyCharacters(token as CharactersToken);
      case TokenType.COMMENT:
        // return this.inBody(token);
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        // return this.inBody(token);
        this.error('unexpected-doctype');
        break;
      case TokenType.EOF:
        return this.inTemplateEof(token);
      case TokenType.START_TAG:
        return this.inTemplateStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.inTemplateEndTag(token as TagToken);
    }
    return this.insertionMode;
  }

  inTemplateEof(token: Token) {
    if (this.openCounts['template']) {
      this.error('abrupt-end-of-template');
      this.popUntilNameHtml('template');
      this.formattingList.clearToMarker();
      this.templateInsertionModes.pop();
      this.resetInsertionMode();
      return this.process(token);
    } else // fragment case
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
        return this.startTextMode(State.RAWTEXT, token);
      case 'script':
        // return this.inHead(token);
        return this.startTextMode(State.SCRIPT_DATA, token);
      case 'title':
        // return this.inHead(token);
        return this.startTextMode(State.RCDATA, token);
      case 'template':
        return this.startTemplate(token);
      case 'caption':
      case 'colgroup':
      case 'tbody':
      case 'tfoot':
      case 'thead':
        return this.updateTemplateModeAndReprocess(InsertionMode.IN_TABLE, token);
      case 'col':
        return this.updateTemplateModeAndReprocess(InsertionMode.IN_COLUMN_GROUP, token);
      case 'tr':
        return this.updateTemplateModeAndReprocess(InsertionMode.IN_TABLE_BODY, token);
      case 'td':
      case 'th':
        return this.updateTemplateModeAndReprocess(InsertionMode.IN_ROW, token);
      default:
        return this.updateTemplateModeAndReprocess(InsertionMode.IN_BODY, token);
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
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        // non-whitespace characters are filtered on tokenizer level
        this.insertCharacters(token as CharactersToken);
        break;
      case TokenType.EOF:
        if (this.openElements.length !== 1 || this.openElements[0].tagName !== 'html') // fragment case
          this.error('abrupt-end-of-frameset');
        return this.stopParsing();
      case TokenType.START_TAG:
        return this.inFramesetStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        return this.startTextMode(State.RAWTEXT, token);
      default:
        this.error('unexpected-content-in-frameset');
    }
    return this.insertionMode;
  }

  inFramesetEndTag(token: TagToken): InsertionMode {
    if (token.name === 'frameset') {
      if (this.openElements.length === 1 && this.openElements[0].tagName === 'html') { // fragment case
        this.error('orphan-end-tag');
      } else {
        this.popCurrentElement();
        if (!this.contextElement && this.current.tagName !== 'frameset')
          return InsertionMode.AFTER_FRAMESET;
      }
    } else
      this.error('unexpected-content-in-frameset');
    return this.insertionMode;
  }

  afterBody(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken, this.openElements[0]);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.afterBodyCharacters(token as CharactersToken);
      case TokenType.START_TAG:
        return this.afterBodyStartTag(token as TagToken);
      case TokenType.END_TAG:
        return this.afterBodyEndTag(token as TagToken);
      case TokenType.EOF:
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
      return InsertionMode.AFTER_AFTER_BODY;
    }
    return this.afterBodyDefault(token);
  }

  afterBodyDefault(token: Token): InsertionMode {
    this.error('content-after-body');
    return this.reprocessIn(InsertionMode.IN_BODY, token);
  }

  afterFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        // non-whitespace characters are filtered on tokenizer level
        this.insertCharacters(token as CharactersToken);
        break;
      case TokenType.EOF:
        return this.stopParsing();
      case TokenType.START_TAG:
        return this.afterFramesetStartTag(token as TagToken);
      case TokenType.END_TAG:
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
        return this.startTextMode(State.RAWTEXT, token);
      default:
        this.error('unexpected-content-after-frameset');
    }
    return this.insertionMode;
  }

  afterFramesetEndTag(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return InsertionMode.AFTER_AFTER_FRAMESET;
      default:
        this.error('unexpected-content-after-frameset');
    }
    return this.insertionMode;
  }

  afterAfterBody(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken, this.document);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.afterAfterBodyCharacters(token as CharactersToken);
      case TokenType.EOF:
        return this.stopParsing();
      case TokenType.START_TAG:
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
    return this.reprocessIn(InsertionMode.IN_BODY, token);
  }

  afterAfterFrameset(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken, this.document);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
        return this.inBodyCharacters(token as CharactersToken);
      case TokenType.EOF:
        return this.stopParsing();
      case TokenType.START_TAG:
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
        return this.startTextMode(State.RAWTEXT, token);
      default:
        this.error('content-after-html');
    }
    return this.insertionMode;
  }

  inForeignContent(token: Token): InsertionMode {
    switch (token.type) {
      case TokenType.COMMENT:
        this.insertComment(token as CommentToken);
        break;
      case TokenType.DOCTYPE:
        this.error('unexpected-doctype');
        break;
      case TokenType.CHARACTERS:
      case TokenType.CDATA:
        this.insertCharacters(token as CharactersToken);
        break;
      case TokenType.START_TAG:
        return this.inForeignContentStartTag(token as TagToken);
      case TokenType.END_TAG:
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
    this.popWhileMatches((n, e) => this.allowsOnlyForeignContent(n, e));
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

  allowsOnlyForeignContent(name: string, element: Element): boolean {
    return element.namespaceURI !== NS_HTML && !this.isMathMLIntegrationPoint(element) && !this.isHTMLIntegrationPoint(element);
  }
}