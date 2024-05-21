import {TokenSink} from '../decl/ParserEnvironment';
import {Node, NodeType} from '../decl/xml-lite-decl';
import {InsertionMode} from './insertion-mode';
import {StaticDataNode} from './nodes/StaticDataNode';
import {StaticDocument} from './nodes/StaticDocument';
import {StaticDocumentType} from './nodes/StaticDocumentType';
import {StaticElement} from './nodes/StaticElement';
import {StaticParentNode} from './nodes/StaticParentNode';
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
export class TreeComposer implements TokenSink {
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
    this.appendToTree(token);
  }

  appendToTree(token: Token) {
    switch (token.type) {
      case 'characters':
      case 'cdata':
      case 'comment':
        const nodeType = TokenTypeMapping[token.type];
        const dataNode = new StaticDataNode(nodeType, this.current, this.currentChildNodes.length, (token as TextToken).data);
        this.currentChildNodes.push(dataNode);
        break;
      case 'doctype':
        const doctypeToken = token as DoctypeToken;
        const documentType = new StaticDocumentType(
            this.current,
            this.currentChildNodes.length,
            doctypeToken.name ?? 'html',
            doctypeToken.publicId ?? '',
            doctypeToken.systemId ?? '');
        this.currentChildNodes.push(documentType);
        break;
      case 'startTag':
        this.startElement(token as TagToken);
        break;
      case 'endTag':
        this.endElement(token as TagToken);
        break;
      case 'eof':
        this.finishTree();
        break;
    }
  }

  popUntilMatches(test: (element: StaticElement, name: string) => boolean) {
    let i = this.openElements.length;
    if (i) {
      let changed = false;
      let element: StaticElement;
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
  startElement(token: TagToken) {
  }

  endElement(token: TagToken) {
  }

  finishTree() {
  }
}