import {TokenSink} from '../../decl/ParserEnvironment';
import {Document, Element, isElement, Node, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {StaticDataNode} from '../nodes/StaticDataNode';
import {StaticDocumentType} from '../nodes/StaticDocumentType';
import {StaticElement} from '../nodes/StaticElement';
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
  position?: number
}

export class BaseComposer implements TokenSink {
  isFragmentParser: boolean = false;

  tokenizer!: StateBasedTokenizer;
  insertionMode: InsertionMode = 'initial';
  originalInsertionMode!: InsertionMode;
  templateInsertionModes: InsertionMode[] = [];

  document!: Document;

  openElements: Element[] = [];
  openCounts: { [tagName: string]: number } = {};
  scopeCounter: number = 0;
  listScopeCounter: number = 0;
  tableScopeCounts: { [tagName: string]: number } = {}; // TODO

  current!: ParentNode;
  headElement!: Element;
  formElement: Element | null = null;

  fosterParentingEnabled: boolean = false; // TODO

  get currentChildNodes(): Node[] {
    return this.current.childNodes as Node[];
  }
  get currentChildElements(): Element[] {
    return this.current.children as Element[];
  }

  accept(token: Token) {
  }

  resetInsertionMode() { // TODO
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
  popCurrentElement() {
    const element = this.openElements.pop()!;
    this.openCounts[element.tagName]--;
    this.current = this.openElements.at(-1) || this.document;
  }

  forceElementAndState(element: string, state: InsertionMode, token: Token): InsertionMode {
    this.createAndInsertElement({
      type: 'startTag',
      name: element,
      selfClosing: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn(state, token);
  }

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
              const table = this.openElements[lastTableIndex];
              const tableParent = table.parentNode;
              if (tableParent) {
                result.parent = tableParent;
                result.position = this.findPosition(tableParent.childNodes, table);
              } else {
                result.parent = this.openElements[lastTableIndex - 1];
              }
            }
        }
      }
    }
    if (isElement(result.parent) && result.parent.tagName === 'template') {
      // TODO use template contents
    }
    return result;
  }

  insertNodeAt(node: Node, location: InsertionLocation) {
    const {parent, position} = location;
    if (position === undefined) {
      this.push(parent.childNodes, node);
      if (isElement(node))
        this.push(parent.children, node);
    } else {
      // TODO this breaks internal indexes
      this.insertAt(parent.childNodes, node, position);
      if (isElement(node))
        this.insertAt(parent.children, node, position);
    }
  }
  // TODO how to use array methods directly while staying decoupled of implementation?
  findPosition<T>(list: ArrayLike<T>, el: T): number {
    return Array.isArray(list) ? list.lastIndexOf(el) : Array.prototype.lastIndexOf.call(list, el);
  }

  push<T>(list: ArrayLike<T>, el: T) {
    if (Array.isArray(list)) list.push(el);
    else Array.prototype.push.call(list, el);
  }

  insertAt<T>(list: ArrayLike<T>, el: T, position: number) {
    if (Array.isArray(list)) list.splice(position, 0, el);
    else Array.prototype.splice.call(list, position, 0, el);
  }

  createElementNS(token: TagToken, namespace: string, parent: ParentNode): Element {
    return new StaticElement(token, namespace, parent, [], []);
  }

  createElement(token: TagToken): Element {
    return new StaticElement(token, NS_HTML, this.current, [], []);
  }

  insertEmptyElement(element: Element): Element {
    this.currentChildNodes.push(element);
    this.currentChildElements.push(element);
    return element;
  }

  createAndInsertEmptyElement(token: TagToken): Element {
    return this.insertEmptyElement(this.createElement(token));
  }

  createAndInsertElement(token: TagToken): Element {
    const element = this.createElement(token);
    this.currentChildNodes.push(element);
    this.currentChildElements.push(element);
    this.openElements.push(element);
    this.current = element;
    this.openCounts[token.name] = (this.openCounts[token.name] || 0) + 1;
    return element;
  }

  startTextMode(tokenizerState: State, token: TagToken): InsertionMode {
    this.createAndInsertElement(token);
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

  stopParsing(): InsertionMode { // TODO
    return this.insertionMode;
  }
}