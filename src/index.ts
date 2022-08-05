import {StringSource} from './StringSource';
import {Document, Element, NamedNode, Node, NodeContainer, NodeType, Text, ValueNode} from './xml-node';

const LT = '<'.charCodeAt(0);
const GT = '>'.charCodeAt(0);
const QUESTION = '?'.charCodeAt(0);
const EXCLAMATION = '!'.charCodeAt(0);
const HYPHEN = '-'.charCodeAt(0);
const EQ = '='.charCodeAt(0);
const QUOTE = '\''.charCodeAt(0);
const DQUOTE = '\"'.charCodeAt(0);
const SLASH = '/'.charCodeAt(0);
const CMT_START = stringToArray('<!--');
const CMT_END = stringToArray('-->');
const CD_START = stringToArray('<![CDATA[');
const CD_END = stringToArray(']]>');
const PI_START = stringToArray('<?');
const PI_END = stringToArray('?>');

function stringToArray(s: string): number[] {
  return [...s].map(c => c.codePointAt(0)!);
}
function isSpace(code: number): boolean {
  return code === 0x20 || code === 9 || code === 10 || code === 13;
}
function isCommonNameStartChar(code: number) {
  return (code >= 0x61 && code <= 0x7A) || // a-z
      (code >= 0x41 && code <= 0x5A) || // A-Z
      code === 0x5F || // underscore (_)
      code === 0x3A;  // colon (:)
}
function isExoticNameStartChar(code: number) {
  return (code >= 0xC0 && code <= 0xD6) ||
      (code >= 0xD8 && code <= 0xF6) ||
      (code >= 0xF8 && code <= 0x2FF) ||
      (code >= 0x370 && code <= 0x37D) ||
      (code >= 0x37F && code <= 0x1FFF) ||
      (code >= 0x200C && code <= 0x200D) ||
      (code >= 0x2070 && code <= 0x218F) ||
      (code >= 0x2C00 && code <= 0x2FEF) ||
      (code >= 0x3001 && code <= 0xD7FF) ||
      (code >= 0xF900 && code <= 0xFDCF) ||
      (code >= 0xFDF0 && code <= 0xFFFD) ||
      (code >= 0x10000 && code <= 0xEFFFF);
}
function isCommonNameChar(code: number) {
  return isCommonNameStartChar(code) ||
      code === HYPHEN ||
      (code >= 0x30 && code <= 0x39) || // 0-9
      code === 0x2E;// period (.)
}
function isExoticNameChar(code: number) {
  return isExoticNameStartChar(code) ||
      code === 0xB7 || // middle dot
      (code >= 0x0300 && code <= 0x03F6) ||
      (code >= 0x203F && code <= 0x2040);
}
function isNameStartChar(code: number): boolean {
  return isCommonNameStartChar(code) || isExoticNameStartChar(code);
}
function isNameChar(code: number): boolean {
  return isCommonNameChar(code) || isExoticNameChar(code);
}

export class Parser {
  node?: Node;

  constructor(private readonly source: StringSource) {
    this.reset();
  }

  reset() {
    this.node = {
      type: 'document',
      childNodes: [],
      children: []
    } as Document;
  }

  document(): Document {
    this.reset();
    this.elementContents();
    return this.node as Document;
  }

  startNode(node: Node, replace = true) {
    const parent = this.node as NodeContainer;
    node.parent = parent;
    parent.childNodes.push(node);
    if (node.type === 'element')
      parent.children.push(node as Element);
    if (replace)
      this.node = node;
  }

  finishNode() {
    this.node = this.node!.parent;
  }

  /**
   @return name of closing tag (with relaxed closing - not necessarily matching enclosing tag)
   */
  elementContents(): string | void {
    while (this.source.get() !== -1) {
      this.readTextNode();
      if (this.source.get() === LT) {
        let closingTagName = this.lt();
        if (closingTagName) return closingTagName;
      } else {
        // this normally happens only for top level node, i.e. document
      }
    }
  }

  readTextNode() {
    let code: number = this.source.next();
    if (code === -1 || code === LT) return;
    this.source.start();
    let blank = true;
    while (code !== -1 && code !== LT) {
      code = this.source.next();
      blank = blank && isSpace(code);
    }
    const value = this.source.end();
    if (value !== '') {
      (this.node as NodeContainer).childNodes.push({
        type: 'text',
        value,
        blank,
        parent: this.node as NodeContainer
      } as Text);
    }
  }

  /**
   * Handle opening angle bracket. It may close an element, or open a new non-text node.
   *
   * @return name of the closing tag or name of tag being improperly closed or nothing if any node opened by this is properly closed.
   */
  lt(): string | void {
    let code = this.source.next();
    if (code === SLASH) return this.closingTag();
    else if (code === QUESTION) this.pi();
    else if (code === EXCLAMATION) this.commentOrCdata();
    else if (isNameChar(code) || isSpace(code)) return this.element();
    else this.unexpected(`Expected valid markup or name`);
  }

  closingTag(): string {
    this.source.next();
    this.skipSpace();
    const name = this.readName();
    if (this.skipSpace() !== GT) this.unexpected(`Expected '>'`);
    return name;
  }

  /**
   * @return name of element it improperly closes or nothing if properly closed
   */
  element(): string | void {
    this.skipSpace();
    const name = this.readName();
    const element = {
      type: 'element',
      name,
      empty: false,
      attributes: {},
      childNodes: [],
      children: []
    } as Element;
    this.startNode(element);
    while (isSpace(this.source.get())) {
      this.skipSpace();
      if (isNameChar(this.source.get()))
        this.attribute();
      else break;
    }
    if (this.source.get() === SLASH) {
      if (this.source.next() !== GT) this.unexpected(`Expected '>'`);
      element.empty = true;
      this.finishNode();
      return;
    } else {
      if (this.source.get() !== GT) this.unexpected(`Expected valid markup or name`);
      const closingName = this.elementContents();
      this.finishNode();
      if (closingName !== name) return closingName;
    }
  }

  attribute() {
    // TODO duplicate attributes
    const node = this.node as NamedNode;
    const name = this.readName();
    this.skipSpace();
    let value: string | null = null;
    if (this.source.get() === EQ) {
      this.source.next();
      this.skipSpace();
      const startQuote = this.source.start();
      if (startQuote !== QUOTE && startQuote !== DQUOTE) this.unexpected(`Expected single (') or double quote (")`);
      this.source.next();
      const endQuote = this.skipTo(startQuote);
      if (startQuote !== endQuote) this.unexpected(`Expected matching quote (${startQuote})`);
      value = this.source.end(1);
      this.source.next();
    }
    node.attributes[name] = value;
  }

  commentOrCdata() {
    const code = this.source.next();
    if (code === CMT_START[2]) this.comment();
    else if (code === CD_START[2]) this.cdata();
    else this.unexpected('Expected comment or CDATA section start');
  }

  comment() {
    this.borderedValueNode('comment', CMT_START, CMT_END, 3);
  }

  cdata() {
    this.borderedValueNode('cdata', CD_START, CD_END, 3);
  }

  pi() {
    this.borderedValueNode('processing-instruction', PI_START, PI_END, 2);
  }

  borderedValueNode(type: NodeType, startSeq: number[], endSeq: number[], startOffset: number) {
    const node = {type} as ValueNode;
    for (let i = startOffset; i < startSeq.length; ++i)
      if (this.source.next() !== startSeq[i]) this.unexpected(`Expected '${String.fromCodePoint(...startSeq)}'`);
    this.source.start();
    if (this.skipToSeq(endSeq) === -1) this.unexpected(`Expected '${String.fromCodePoint(...endSeq)}'`);
    node.value = this.source.end(1, endSeq.length - 1);
    this.startNode(node, false);
  }

  skipTo(terminator: number): number {
    let code: number = this.source.get();
    while (code !== -1 && code !== terminator)
      code = this.source.next();
    return code;
  }

  skipToSeq(seq: number[]): number {
    const indexes = Array(seq.length);
    let size = 0;
    let code: number;
    while ((code = this.source.next()) !== -1) {
      indexes[size++] = 0;
      let j = 0;
      for (let i = 0; i < size; ++i) {
        let index = indexes[i];
        if (seq[index] === code) {
          if ((indexes[j++] = ++index) === seq.length)
            return code;
        }
      }
      size = j;
    }
    return code;
  }

  skipSpace(): number {
    let code = this.source.get();
    while (isSpace(code))
      code = this.source.next();
    return code;
  }

  readName(): string {
    this.source.start();
    if (!isNameStartChar(this.source.get()))
      this.unexpected('Name start expected');
    let code;
    do {
      code = this.source.next();
    } while (isNameChar(code));
    return this.source.end();
  }

  unexpected(message: string) {
    const code = this.source.get();
    if (code === -1)
      throw new Error(`${message}, found end of input`);
    else
      throw new Error(`${message}, found '${String.fromCodePoint(code)}' (0x${code.toString(16).toUpperCase()})`);
  }
}
