import {TokenSink} from '../../decl/ParserEnvironment';
import {Document, Element, isElement, Node, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {StaticDataNode} from '../nodes/StaticDataNode';
import {StaticDocument} from '../nodes/StaticDocument';
import {StaticDocumentType} from '../nodes/StaticDocumentType';
import {StaticElement} from '../nodes/StaticElement';
import {StaticEmptyNode} from '../nodes/StaticEmptyNode';
import {StaticParentNode} from '../nodes/StaticParentNode';
import {StateBasedTokenizer} from '../StateBasedTokenizer';
import {State} from '../states';
import {DoctypeToken, TagToken, TextToken, Token} from '../tokens';
import {InsertionMode} from './insertion-mode';

/*
void elements
area, base, br, col, embed, hr, img, input, link, meta, source, track, wbr
*/
const TokenTypeMapping = {
  'doctype': NodeType.DOCUMENT_TYPE_NODE,
  'startTag': NodeType.ELEMENT_NODE,
  'endTag': NodeType.ELEMENT_NODE,
  'comment': NodeType.COMMENT_NODE,
  'characters': NodeType.TEXT_NODE,
  'cdata': NodeType.CDATA_SECTION_NODE
};

const IMPLICITLY_CLOSABLE = {
  'dd': true,
  'dt': true,
  'li': true,
  'optgroup': true,
  'option': true,
  'p': true,
  'rb': true,
  'rp': true,
  'rt': true,
  'rtc': true
};

const IMPLICITLY_THOROUGHLY_CLOSABLE = {
  ...IMPLICITLY_CLOSABLE,
  'caption': true,
  'colgroup': true,
  'tbody': true,
  'td': true,
  'tfoot': true,
  'th': true,
  'thead': true,
  'tr': true
};

export const NS_HTML = 'http://www.w3.org/1999/xhtml';
export const NS_MATHML = 'http://www.w3.org/1998/Math/MathML';
export const NS_SVG = 'http://www.w3.org/2000/svg';
export const NS_XLINK = 'http://www.w3.org/1999/xlink';
export const NS_XML = 'http://www.w3.org/XML/1998/namespace';
export const NS_XMLNS = 'http://www.w3.org/2000/xmlns/';

type InsertionLocation = {
  parent: ParentNode,
  before?: Element // this can only be a table
}

// TODO when partial composers are merged refine cross-calls where needed
export class BaseComposer implements TokenSink {
  tokenizer!: StateBasedTokenizer;
  insertionMode: InsertionMode = 'initial';
  originalInsertionMode!: InsertionMode;
  templateInsertionModes: InsertionMode[] = [];

  document!: Document;
  contextElement?: Element;

  openElements: Element[] = [];
  openCounts: { [tagName: string]: number } = {};

  headElement: Element | null = null;
  formElement: Element | null = null;

  fosterParentingEnabled: boolean = false;
  fosterTables: Map<Element, Node[]> = new Map<Element, Node[]>(); // keys are table elements, values are collection of elements inserted just before them

  framesetOk: boolean = true;
  formattingElements: Element[] = [];

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
    this.fosterParentingEnabled = false;
    this.fosterTables.clear();
    this.framesetOk = true;
    this.formattingElements.length = 0;
    this.document = new StaticDocument([], []);
    if (!(this.contextElement = contextElement)) {
      this.tokenizer.state = 'data';
      this.insertionMode = 'initial';
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
    // @ts-ignore
    return this[mode](token);
  }

  setInsertionMode(value: InsertionMode) {
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

  inBody(token: Token): InsertionMode {
    throw new Error('Malformed inheritance');
  }

  inHead(token: Token): InsertionMode {
    throw new Error('Malformed inheritance');
  }

  inTemplate(token: Token): InsertionMode {
    throw new Error('Malformed inheritance');
  }

  inForeignContent(token: Token): InsertionMode {
    throw new Error('Malformed inheritance');
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
        const encoding = (element.getAttribute('encoding') || '').toLowerCase();
        return encoding === 'text/html' || encoding === 'application/xhtml+xml';
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

  protected insertDoctype(doctypeToken: DoctypeToken) {
    const documentType = new StaticDocumentType(this.document, doctypeToken.name ?? 'html', doctypeToken.publicId ?? '', doctypeToken.systemId ?? '');
    this.push(this.document.childNodes, documentType);
  }

  protected insertDataNode(token: TextToken) {
    // TODO characters into document should be dropped on the floor
    const nodeType = TokenTypeMapping[token.type];
    const parent = this.adjustedCurrentNode || this.document;
    const dataNode = new StaticDataNode(nodeType, parent, token.data);
    this.push(parent.childNodes, dataNode);
  }

  generateImpliedEndTagsFromSet(closable: { [tagName: string]: any }, exclude?: string) {
    this.popUntilMatches((name, el) => name !== exclude && (name in closable) && el.namespaceURI === NS_HTML);
  }
  generateImpliedEndTags(exclude?: string) {
    return this.generateImpliedEndTagsFromSet(IMPLICITLY_CLOSABLE, exclude);
  }
  generateImpliedEndTagsThoroughly() {
    return this.generateImpliedEndTagsFromSet(IMPLICITLY_THOROUGHLY_CLOSABLE);
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
    const element = new StaticElement(token, namespace, parent, [], []);
    this.validateNsAttributes(element);
    return element;
  }

  protected validateNsAttributes(element: Element) {
    if (element.hasAttribute('xmlns')) {
      const attr = element.getAttributeNode('xmlns')!;
      if (attr.namespaceURI === NS_XMLNS && attr.localName === 'xmlns' && attr.value !== element.namespaceURI)
        this.error();
    }
    if (element.hasAttribute('xmlns:xlink')) {
      const attr = element.getAttributeNode('xmlns:xlink')!;
      if (attr.namespaceURI === NS_XMLNS && attr.localName === 'xlink' && attr.value !== NS_XLINK)
        this.error();
    }
  }

  /** a-ka "appropriate place for inserting a node" */
  getInsertionLocation(override?: ParentNode): InsertionLocation {
    const target: ParentNode = override || this.current || this.document;
    const result: InsertionLocation = {
      parent: target
    };
    if (this.fosterParentingEnabled) {
      if (isElement(target)) {
        switch (target.tagName) {
          case 'table':
          case 'tbody':
          case 'tfoot':
          case 'thead':
          case 'tr':
            let lastTemplateIndex = this.openElements.findLastIndex(el => el.tagName === 'template');
            let lastTableIndex = this.openElements.findLastIndex(el => el.tagName === 'table');
            if (lastTemplateIndex >= 0 && (lastTableIndex < 0 || lastTemplateIndex > lastTableIndex)) {
              result.parent = this.openElements[lastTemplateIndex];
            } else if (lastTableIndex < 0) {
              result.parent = this.openElements[0];
            } else {
              result.parent = (result.before = this.openElements[lastTableIndex]).parentNode!;
            }
        }
      }
    }
    if (isElement(result.parent) && result.parent.tagName === 'template') {
      // TODO use template contents
    }
    return result;
  }

  insertElementAtLocation(node: Node, location: InsertionLocation) {
    const {parent, before} = location;
    // TODO is it whenever a case when insertion is not possible?
    if (!before) {
      this.push(parent.childNodes, node);
      if (isElement(node))
        this.push(parent.children, node);
    } else {
      if (!this.fosterTables.has(before))
        this.fosterTables.set(before, []);
      this.fosterTables.get(before)!.push(node);
    }
  }

  /** a-ka "insert a foreign element" */
  createAndInsertElementNS(token: TagToken, namespace: string | null, popImmediately: boolean, onlyAddToStack: boolean = false): Element {
    let location = this.getInsertionLocation();
    if (!popImmediately && token.selfClosed)
      this.error();
    token.selfClosed = popImmediately;
    let element = this.createElementNS(token, namespace, location.parent);
    if (!onlyAddToStack)
      this.insertElementAtLocation(element, location);
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

  popUntilMatches(test: (name: string, element: Element) => boolean) {
    let i = this.openElements.length;
    if (i) {
      let element!: Element;
      for (--i; i >= 0; --i) {
        element = this.openElements[i];
        const name = element.tagName;
        if (test(name, element)) {
          this.openElements.pop();
          this.openCounts[name]--;
          // TODO sync all add/remove with stack
        } else
          break;
      }
    }
  }

  popUntilName(name: string, namespace: string = NS_HTML) {
    this.popUntilMatches((n, el) => n !== name || el.namespaceURI !== namespace);
    this.popCurrentElement();
  }

  popToLength(len: number) {
    while (this.openElements.length > len)
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

  startTemplate(start: TagToken): InsertionMode { // TODO
    return this.insertionMode;
  }

  endTemplate(end: TagToken): InsertionMode { // TODO
    return this.insertionMode;
  }

  error() { // TODO
  }

  closeParagraph() {
    this.generateImpliedEndTags('p');
    if (this.current.tagName !== 'p')
      this.error();
    this.popUntilName('p');
  }

  clearFormattingUpToMarker() { // TODO
  }

  insertFormattingMarker() { // TODO
  }

  reconstructFormattingElements() { // TODO
  }

  getActiveFormattingElement(name: string): Element | null { // TODO
    return null;
  }

  removeFormattingElement(element: Element) { // TODO
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
    if (element.namespaceURI !== NS_HTML) return false;
    return element.tagName === 'ol' || element.tagName === 'ul';
  }

  isButtonScopeFence(element: Element): boolean {
    if (this.isScopeFence(element)) return true;
    if (element.namespaceURI !== NS_HTML) return false;
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
    if (element.namespaceURI !== NS_HTML) return true;
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

  settleFosterChildren() {
    const parents: Map<ParentNode, [Node[], Element[]]> = new Map<ParentNode, [Node[], Element[]]>();
    for (let table of this.fosterTables.keys()) {
      const parent = table.parentNode!;
      const newChildNodes: Node[] = [];
      const newChildren: Element[] = [];
      parents.set(parent, [newChildNodes, newChildren]);
      for (let node of parent.childNodes) {
        this.collectFosterNode(node, newChildNodes, newChildren);
      }
    }
    for (let [parent, [childNodes, children]] of parents) {
      childNodes.forEach(this.setNodeIndex, this);
      children.forEach(this.setElementIndex, this);
      this.setNestedNodes(parent, childNodes, children);
    }
    this.fosterTables.clear();
  }

  collectFosterNode(node: Node, childNodes: Node[], children: Element[]) {
    if (isElement(node)) {
      if (this.fosterTables.has(node)) {
        const predecessors = this.fosterTables.get(node)!;
        for (let extraNode of predecessors)
          this.collectFosterNode(extraNode, childNodes, children);
        predecessors.length = 0;
      }
      children.push(node);
    }
    childNodes.push(node);
  }
  // TODO these methods are tied to StaticXXX implementation - not good
  setNodeIndex(node: Node, nodeIndex: number) {
    (node as StaticEmptyNode).parentIndex = nodeIndex;
  }
  setElementIndex(el: Element, elementIndex: number) {
    (el as StaticElement).parentElementIndex = elementIndex;
  }
  setNestedNodes(parent: ParentNode, childNodes: Node[], children: Element[]) {
    //@ts-ignore
    (parent as StaticParentNode).childNodes = childNodes;
    //@ts-ignore
    (parent as StaticParentNode).children = children;
  }

  stopParsing(): InsertionMode { // TODO
    this.settleFosterChildren();
    return this.insertionMode;
  }

  push<T>(list: ArrayLike<T>, el: T) {
    if (Array.isArray(list)) list.push(el);
    else Array.prototype.push.call(list, el);
  }
}