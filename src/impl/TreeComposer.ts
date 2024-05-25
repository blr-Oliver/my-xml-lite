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
  headElement!: StaticElement;

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
        return this.forceElementAndState('html', 'beforeHead', token);
      case 'endTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'head':
          case 'body':
          case 'html':
          case 'br':
            return this.forceElementAndState('html', 'beforeHead', token);
          default:
            this.error();
            return 'beforeHtml';
        }
      default:
        return this.forceElementAndState('html', 'beforeHead', token);
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
            this.headElement = this.createAndPushElement(tagToken);
            return 'inHead';
          default:
            return this.forceHead(token);
        }
      case 'endTag':
        switch (tagToken.name) {
          case 'head':
          case 'body':
          case 'html':
          case 'br':
            return this.forceHead(token);
          default:
            this.error();
        }
    }
    return this.insertionMode;
  }

  forceHead(token: Token): InsertionMode {
    this.headElement = this.createAndPushElement({
      type: 'startTag',
      name: 'head',
      selfClosing: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn('inHead', token);
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
    return this.insertionMode;
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
    return this.insertionMode;
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
    return this.insertionMode;
  }

  inHeadNoscript(token: Token): InsertionMode {
    let tagToken: TagToken;
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        this.insertDataNode(token as TextToken);
        break;
      case 'startTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'html':
            return this.inBody(token);
          case 'basefont':
          case 'bgsound':
          case 'link':
          case 'meta':
          case 'noframes':
          case 'style':
            return this.startTagInHead(tagToken);
          case 'head':
          case 'noscript':
            this.error();
            break;
          default:
            return this.escapeNoscript(token);
        }
        break;
      case 'endTag':
        tagToken = token as TagToken;
        switch (tagToken.name) {
          case 'noscript':
            this.popCurrentElement();
            return 'inHead';
          case 'br':
            return this.escapeNoscript(token);
          default:
            this.error();
            break;
        }
        break;
      default:
        return this.escapeNoscript(token);
    }
    return this.insertionMode;
  }

  escapeNoscript(token: Token): InsertionMode {
    this.error();
    this.popCurrentElement();
    return this.reprocessIn('inHead', token);
  }

  afterHead(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertDataNode(token as TextToken);
        break;
      case 'doctype':
        this.error();
        break;
      case 'characters':
        // TODO whitespace only
        this.insertDataNode(token as TextToken);
        break;
      case 'startTag':
        return this.startTagAfterHead(token as TagToken);
      case 'endTag':
        return this.endTagAfterHead(token as TagToken);
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  startTagAfterHead(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'head':
        this.error();
        break;
      case 'html':
        return this.inBody(token);
      case 'body':
        this.createAndPushElement(token);
        // TODO frameset-ok flag
        return 'inBody';
      case 'frameset':
        this.createAndPushElement(token);
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
        this.error();
        this.openElements.push(this.current = this.headElement);
        this.openCounts['head'] = (this.openCounts['head'] || 0) + 1;
        let result = this.inHead(token);
        let index = this.openElements.indexOf(this.headElement);
        if (index === this.openElements.length - 1)
          this.popCurrentElement();
        else {
          this.openElements.splice(index, 1);
          this.openCounts['head']--;
        }
        return result;
      default:
        return this.forceElementAndState('body', 'inBody', token);
    }
    return this.insertionMode;
  }

  endTagAfterHead(token: TagToken): InsertionMode {
    switch (token.name) {
      case 'template':
        return this.endTagInHead(token);
      case 'body':
      case 'html':
      case 'br':
        return this.forceElementAndState('body', 'inBody', token);
      default:
        this.error();
        return this.insertionMode;
    }
  }

  inBody(token: Token): InsertionMode {
    return this.insertionMode;
  }

  forceElementAndState(element: string, state: InsertionMode, token: Token): InsertionMode {
    this.createAndPushElement({
      type: 'startTag',
      name: element,
      selfClosing: false,
      attributes: []
    } as TagToken);
    return this.reprocessIn(state, token);
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
    this.createAndPushElement(token);
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