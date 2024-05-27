import {TokenSink} from '../../decl/ParserEnvironment';
import {Node, NodeType} from '../../decl/xml-lite-decl';
import {StaticDataNode} from '../nodes/StaticDataNode';
import {StaticDocument} from '../nodes/StaticDocument';
import {StaticDocumentType} from '../nodes/StaticDocumentType';
import {StaticElement} from '../nodes/StaticElement';
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


export class BaseComposer implements TokenSink {

  tokenizer!: StateBasedTokenizer;
  insertionMode: InsertionMode = 'initial';
  originalInsertionMode!: InsertionMode;

  document!: StaticDocument;

  openElements: StaticElement[] = [];
  openCounts: { [tagName: string]: number } = {};
  scopeCounter: number = 0;
  listScopeCounter: number = 0;
  tableScopeCounts: { [tagName: string]: number } = {}; // TODO

  current!: StaticParentNode;
  headElement!: StaticElement;
  formElement: StaticElement | null = null;

  fosterParentingEnabled: boolean = false; // TODO

  get currentChildNodes(): Node[] {
    return this.current.childNodes;
  }
  get currentChildElements(): StaticElement[] {
    return this.current.children;
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
    const documentType = new StaticDocumentType(
        this.current,
        this.currentChildNodes.length,
        doctypeToken.name ?? 'html',
        doctypeToken.publicId ?? '',
        doctypeToken.systemId ?? '');
    this.currentChildNodes.push(documentType);
  }

  protected insertDataNode(token: TextToken) {
    const nodeType = TokenTypeMapping[token.type];
    const dataNode = new StaticDataNode(nodeType, this.current, this.currentChildNodes.length, token.data);
    this.currentChildNodes.push(dataNode);
  }

  popUntilMatches(test: (name: string, element: StaticElement) => boolean) {
    let i = this.openElements.length;
    if (i) {
      let changed = false;
      let element!: StaticElement;
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

  createElement(token: TagToken): StaticElement {
    return new StaticElement(token, this.current, [], this.currentChildNodes.length, this.currentChildElements.length, []);
  }

  insertEmptyElement(element: StaticElement): StaticElement {
    this.currentChildNodes.push(element);
    this.currentChildElements.push(element);
    return element;
  }

  createAndInsertEmptyElement(token: TagToken): StaticElement {
    return this.insertEmptyElement(this.createElement(token));
  }

  createAndInsertElement(token: TagToken): StaticElement {
    const childNodes: Node[] = [];
    const childElements: StaticElement[] = [];
    const element = new StaticElement(token, this.current, childNodes, this.currentChildNodes.length, this.currentChildElements.length, childElements);
    this.currentChildNodes.push(element);
    this.currentChildElements.push(element);
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
}