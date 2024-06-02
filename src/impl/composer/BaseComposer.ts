import {TokenSink} from '../../decl/ParserEnvironment';
import {Document, Element, isElement, Node, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {StaticDataNode} from '../nodes/StaticDataNode';
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

export class BaseComposer implements TokenSink {
  isFragmentParser: boolean = false;

  tokenizer!: StateBasedTokenizer;
  insertionMode: InsertionMode = 'initial';
  originalInsertionMode!: InsertionMode;
  templateInsertionModes: InsertionMode[] = [];

  document!: Document;
  contextElement?: Element;

  openElements: Element[] = [];
  openCounts: { [tagName: string]: number } = {};
  scopeCounter: number = 0;
  listScopeCounter: number = 0;
  tableScopeCounts: { [tagName: string]: number } = {}; // TODO

  current!: ParentNode;
  headElement!: Element;
  formElement: Element | null = null;

  fosterParentingEnabled: boolean = false; // TODO
  fosterTables: Map<Element, Node[]> = new Map<Element, Node[]>(); // keys are table elements, values are collection of elements inserted just before them

  get currentChildNodes(): Node[] {
    return this.current.childNodes as Node[];
  }
  get currentChildElements(): Element[] {
    return this.current.children as Element[];
  }
  get adjustedCurrentNode(): Element {
    return this.openElements.length <= 1 ? (this.contextElement || this.openElements[0]) : this.openElements[this.openElements.length - 1];
  }

  accept(token: Token) {
  }

  resetInsertionMode() {
    this.insertionMode = this.computeInsertionMode();
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

  protected insertDoctype(doctypeToken: DoctypeToken) {
    const documentType = new StaticDocumentType(this.current, doctypeToken.name ?? 'html', doctypeToken.publicId ?? '', doctypeToken.systemId ?? '');
    this.currentChildNodes.push(documentType);
  }

  protected insertDataNode(token: TextToken) {
    const nodeType = TokenTypeMapping[token.type];
    const dataNode = new StaticDataNode(nodeType, this.current, this.currentChildNodes.length, token.data);
    this.currentChildNodes.push(dataNode);
  }

  popUntilMatches(test: (name: string, element: Element) => boolean) {
    let i = this.openElements.length;
    if (i) {
      let changed = false;
      let element!: Element;
      for (--i; i >= 0; --i) {
        element = this.openElements[i];
        const name = element.tagName;
        if (test(name, element)) {
          this.openElements.pop();
          this.openCounts[name]--;
          changed = true;
        } else
          break;
      }
      if (changed)
        this.current = i < 0 ? this.document : element;
    }
  }
  generateImpliedEndTagsFromSet(closable: { [tagName: string]: any }, exclude?: string) {
    this.popUntilMatches(name => name !== exclude && (name in closable));
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
      selfClosing: false,
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
    const target: ParentNode = override || this.current;
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
    this.current = element;
    this.openCounts[element.tagName] = (this.openCounts[element.tagName] || 0) + 1;
  }

  popCurrentElement() {
    const element = this.openElements.pop()!;
    this.openCounts[element.tagName]--;
    this.current = this.openElements.at(-1) || this.document;
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

  reprocessIn(mode: InsertionMode, token: Token): InsertionMode {
    this.insertionMode = mode;
    // @ts-ignore
    return this[mode](token);
  }
  error() { // TODO
  }

  closeParagraph() {
    if (this.openCounts['p']) {
      this.popUntilMatches(name => name !== 'p');
      if (this.openElements.length) {
        this.openElements.pop();
        this.openCounts['p']--;
        this.current = this.openElements[this.openElements.length - 1] || this.document;
      }
    } else {
      this.openCounts = {};
      this.openElements.length = 0;
      this.current = this.document;
    }
  }

  clearFormattingUpToMarker() { // TODO
  }

  insertFormattingMarker() { // TODO
  }

  hasElementInSelectScope(name: string): boolean { // TODO
    return false;
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