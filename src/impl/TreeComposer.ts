import {TokenSink} from '../decl/ParserEnvironment';
import {Node, NodeType} from '../decl/xml-lite-decl';
import {InsertionMode} from './insertion-mode';
import {StaticDataNode} from './nodes/StaticDataNode';
import {StaticDocument} from './nodes/StaticDocument';
import {StaticDocumentType} from './nodes/StaticDocumentType';
import {StaticElement} from './nodes/StaticElement';
import {StaticParentNode} from './nodes/StaticParentNode';
import {StateBasedTokenizer} from './StateBasedTokenizer';
import {State} from './states';
import {DoctypeToken, TagToken, TextToken, Token} from './tokens';


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

/*
  no script execution
  quirks mode is never enabled
  template is treated as ordinary element
  formatting elements are ignored
*/
const EMPTY_HTML: TagToken = {
  type: 'startTag',
  name: 'html',
  selfClosing: false,
  attributes: []
};

const EMPTY_HEAD: TagToken = {
  type: 'startTag',
  name: 'head',
  selfClosing: false,
  attributes: []
}

export class TreeComposer implements TokenSink {
  tokenizer!: StateBasedTokenizer;
  insertionMode: InsertionMode = 'initial';
  originalInsertionMode!: InsertionMode;

  document!: StaticDocument;
  openElements: StaticElement[] = [];
  openCounts: { [tagName: string]: number } = {};
  scopeCounter: number = 0;
  listScopeCounter: number = 0;
  tableScopeCounter: number = 0;

  current!: StaticParentNode;
  get currentChildNodes(): Node[] {
    return this.current.childNodes;
  }
  get currentChildElements(): StaticElement[] {
    return this.current.children;
  }

  accept(token: Token) {
  }

  private insertDoctype(doctypeToken: DoctypeToken) {
    const documentType = new StaticDocumentType(
        this.current,
        this.currentChildNodes.length,
        doctypeToken.name ?? 'html',
        doctypeToken.publicId ?? '',
        doctypeToken.systemId ?? '');
    this.currentChildNodes.push(documentType);
  }

  private insertDataNode(token: TextToken) {
    const nodeType = TokenTypeMapping[token.type];
    const dataNode = new StaticDataNode(nodeType, this.current, this.currentChildNodes.length, token.data);
    this.currentChildNodes.push(dataNode);
  }

  popUntilMatches(test: (element: StaticElement, name: string) => boolean) {
    let i = this.openElements.length;
    if (i) {
      let changed = false;
      let element!: StaticElement;
      for (--i; i >= 0; --i) {
        element = this.openElements[i];
        const name = element.tagName;
        if (test(element, name)) {
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
    this.popUntilMatches((element, name) => name !== exclude && (name in closable));
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

  closeParagraph() {
    if (this.openCounts['p']) {
      this.popUntilMatches((element, name) => name !== 'p');
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

  initial(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        return 'initial';
      case 'doctype':
        this.insertDoctype(token as DoctypeToken);
        return 'beforeHtml';
      default:
        //TODO in this state whitespace should be ignored at tokenizer level
        return this.beforeHtml(token);
    }
  }

  beforeHtml(token: Token): InsertionMode {
    let tagToken: TagToken;
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        return 'beforeHtml';
      case 'doctype':
        this.error();
        return 'beforeHtml';
      case 'startTag':
        tagToken = token as TagToken;
        if (tagToken.name === 'html') {
          this.createAndPushElement(tagToken);
          return 'beforeHead';
        }
        return this.forceHtmlElement(token);
      case 'endTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'head':
          case 'body':
          case 'html':
          case 'br':
            return this.forceHtmlElement(token);
          default:
            this.error();
            return 'beforeHtml';
        }
      default:
        return this.forceHtmlElement(token);
    }
  }

  beforeHead(token: Token): InsertionMode {
    let tagToken = token as TagToken;
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'startTag':
        switch (tagToken.name) {
          case 'html':
            return this.inBody(token);
          case 'head':
            this.createAndPushElement(tagToken);
            return 'inHead';
          default:
            return this.forceHeadElement(token);
        }
      case 'endTag':
        switch (tagToken.name) {
          case 'head':
          case 'body':
          case 'html':
          case 'br':
            return this.forceHeadElement(token);
          default:
            this.error();
        }
    }
    return 'beforeHead';
  }

  inHead(token: Token): InsertionMode {
    let tagToken = token as TagToken;
    switch (token.type) {
      case 'characters':
        // TODO separate whitespace and text
        this.insertDataNode(token as TextToken);
        break;
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'startTag':
        return this.startTagInHead(token as TagToken);
      case 'endTag':
        return this.endTagInHead(token as TagToken);
      default:
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
    }
    return 'inHead';
  }

  startTagInHead(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'html':
        return this.inBody(token);
      case 'base':
      case 'basefont':
      case 'bgsound':
      case 'link':
      case 'meta':
        this.createAndAddEmptyElement(token);
        break;
      case 'title':
        return this.startTextMode('rcdata', token);
      case 'noscript':
      case 'noframes':
      case 'style':
        return this.startTextMode('rawtext', token);
      case 'script':
        return this.startTextMode('scriptData', token);
      case 'template':
        return this.startTemplate(token);
      case 'head':
        this.error();
        break;
      default:
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
    }
    return 'inHead';
  }

  endTagInHead(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.popCurrentElement();
        return 'afterHead';
      case 'template':
        if (this.openCounts['template'])
          return this.endTemplate(token);
        this.error();
        break;
      case 'body':
      case 'html':
      case 'br':
        this.popCurrentElement();
        return this.reprocessIn('afterHead', token);
      default:
        this.error();
    }
    return 'inHead';
  }

  inHeadNoscript(token: Token): InsertionMode {
    return 'inHeadNoscript';
  }

  afterHead(token: Token): InsertionMode {
    return 'afterHead';
  }

  inBody(token: Token): InsertionMode {
    return 'inBody';
  }

  forceHtmlElement(token: Token): InsertionMode {
    this.createAndPushElement(EMPTY_HTML);
    return this.beforeHead(token);
  }

  forceHeadElement(token: Token): InsertionMode {
    this.createAndPushElement(EMPTY_HEAD);
    return this.inHead(token);
  }

  createAndAddEmptyElement(token: TagToken): StaticElement {
    const element = new StaticElement(token, this.current, [], this.currentChildNodes.length, this.currentChildElements.length, []);
    this.currentChildNodes.push(element);
    this.currentChildElements.push(element);
    return element;
  }

  createAndPushElement(token: TagToken): StaticElement {
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
    this.createAndAddEmptyElement(token);
    this.originalInsertionMode = this.insertionMode;
    this.tokenizer.state = tokenizerState;
    this.tokenizer.lastOpenTag = token.name;
    return 'text';
  }

  startTemplate(start: TagToken): InsertionMode {
    // TODO
    return this.insertionMode;
  }

  endTemplate(end: TagToken): InsertionMode {
    // TODO
    return this.insertionMode;
  }

  reprocessIn(mode: InsertionMode, token: Token): InsertionMode {
    this.insertionMode = mode;
    // @ts-ignore
    return this[mode](token);
  }
  error() {
    // TODO
  }
}