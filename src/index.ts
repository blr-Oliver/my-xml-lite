export type NodeType = 'document' | 'element' | 'text' | 'comment' | 'cdata' | 'directive';

export interface Node {
  type: NodeType;
  parent?: Element;
}

export interface Document {
  type: 'document';
  children: Node[];
  elements: Element[];
}

export interface NamedNode extends Node {
  name: string;
  attributes: { [key: string]: string | null };
}

export interface ValueNode extends Node {
  value: string;
}

export interface Directive extends NamedNode {
  type: 'directive';
}

export interface Element extends NamedNode {
  type: 'element';
  empty: boolean;
  children: Node[];
  elements: Element[];
}

export interface Text extends ValueNode {
  type: 'text';
}

export interface Comment extends ValueNode {
  type: 'comment';
}

export interface CData extends ValueNode {
  type: 'cdata';
}

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

function stringToArray(s: string): number[] {
  return Array.from(Array(s.length), (_, i) => s.charCodeAt(i));
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
  private readonly path: Node[] = [];

  node?: Node;
  lastPos: number = -1;
  nextPos: number = 0;
  lastCode: number = -2;

  constructor(private readonly input: Uint16Array) {
    this.reset();
  }

  reset() {
    this.lastPos = -1;
    this.lastCode = -2;
    this.nextPos = 0;
    this.path.length = 0;
    this.node = {
      type: 'document',
      children: [],
      elements: []
    } as Document;
    this.path.push(this.node);
  }

  document(): Node[] {
    this.reset();
    this.elementContents();
    let result: Node[] = (this.node as Element).children
    result.forEach(node => delete node.parent);
    return result;
  }

  startNewNode(node: Node) {
    let element = this.node as Element;
    node.parent = element;
    element.children.push(node);
    if (node.type === 'element')
      element.elements.push(node as Element);
    this.path.push(node);
    this.node = node;
  }

  finishCurrentNode() {
    this.path.pop();
    this.node = this.path[this.path.length - 1];
  }

  /**
   @return name of closing tag (with relaxed closing - not necessarily matching enclosing tag)
   */
  elementContents(): string | void {
    while (this.lastCode !== -1) {
      this.readTextNode();
      if (this.lastCode === LT) {
        let closingTagName = this.lt();
        if (closingTagName) return closingTagName;
      } else {
        // this normally happens only for top level node, i.e. document
      }
    }
  }

  readTextNode() {
    const value = this.readText();
    if (value != '') {
      (this.node as Element).children.push({
        type: 'text',
        value,
        parent: this.node as Element
      } as Text);
    }
  }
  /**
   * Handle opening angle bracket. It may close an element, or open a new non-text node.
   *
   * @return name of the closing tag or name of tag being improperly closed or nothing if any node opened by this is properly closed.
   */
  lt(): string | void {
    let code = this.consumeNext();
    if (code === SLASH) return this.closingTag();
    else if (code === QUESTION) this.directive();
    else if (code === EXCLAMATION) this.commentOrCdata();
    else if (isNameChar(code) || isSpace(code)) return this.element();
    else this.unexpected(`Expected valid markup or name`);
  }

  closingTag(): string {
    this.consumeNext();
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
      children: [],
      elements: []
    } as Element;
    this.startNewNode(element);
    while (isSpace(this.lastCode)) {
      this.skipSpace();
      if (isNameChar(this.lastCode))
        this.attribute();
      else break;
    }
    if (this.lastCode === SLASH) {
      if (this.consumeNext() !== GT) this.unexpected(`Expected '>'`);
      element.empty = true;
      this.finishCurrentNode();
      return;
    } else {
      if (this.lastCode !== GT) this.unexpected(`Expected valid markup or name`);
      const closingName = this.elementContents();
      this.finishCurrentNode();
      if (closingName !== name) return closingName;
    }
  }

  attribute() {
    // TODO duplicate attributes
    const node = this.node as NamedNode;
    const name = this.readName();
    this.skipSpace();
    let value: string | null = null;
    if (this.lastCode === EQ) {
      this.consumeNext();
      this.skipSpace();
      const startQuote = this.lastCode;
      if (startQuote !== QUOTE && startQuote !== DQUOTE) this.unexpected(`Expected single (') or double quote (")`);
      const start = this.nextPos;
      this.consumeNext();
      const endQuote = this.skipTo(startQuote);
      if (startQuote !== endQuote) this.unexpected(`Expected matching quote (${startQuote})`);
      value = String.fromCharCode(...this.input.slice(start, this.lastPos));
      this.consumeNext();
    }
    node.attributes[name] = value;
  }

  commentOrCdata() {
    const code = this.consumeNext();
    if (code === CMT_START[2]) this.comment();
    else if (code === CD_START[2]) this.cdata();
    else this.unexpected('Expected comment or CDATA section start');
  }

  comment() {
    const comment = {
      type: 'comment'
    } as Comment;
    this.startNewNode(comment);
    if (this.consumeNext() !== HYPHEN) this.unexpected(`Expected '<!--'`);
    const start = this.nextPos;
    if (this.skipToSeq(CMT_END) === -1) this.unexpected(`Expected '-->'`);
    comment.value = String.fromCharCode(...this.input.slice(start, this.nextPos - CMT_END.length));
    this.finishCurrentNode();
  }

  cdata() {
    const cdata = {
      type: 'cdata'
    } as CData;
    this.startNewNode(cdata);
    for (let i = 3; i < CD_START.length; ++i)
      if (this.consumeNext() !== CD_START[i]) this.unexpected(`Expected '<![CDATA['`);
    const start = this.nextPos;
    if (this.skipToSeq(CD_END) === -1) this.unexpected(`Expected ']]>'`);
    cdata.value = String.fromCharCode(...this.input.slice(start, this.nextPos - CD_END.length));
    this.finishCurrentNode();
  }

  directive() {
    this.skipSpace();
    const name = this.readName();
    const element = {
      type: 'directive',
      name,
      attributes: {}
    } as Directive;
    this.startNewNode(element);
    while (isSpace(this.lastCode)) {
      this.skipSpace();
      if (isNameChar(this.lastCode))
        this.attribute();
      else break;
    }
    if (this.lastCode !== QUESTION || this.consumeNext() !== GT) this.unexpected(`Expected '?>'`);
    this.finishCurrentNode();
  }

  skipTo(terminator: number): number {
    let code: number = this.lastCode;
    while (code !== -1 && code !== terminator)
      code = this.consumeNext();
    return code;
  }

  skipToSeq(seq: number[]): number {
    const indexes = Array(seq.length);
    let size = 0;
    let code: number;
    while ((code = this.consumeNext()) !== -1) {
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
    let code = this.lastCode;
    while (isSpace(code))
      code = this.consumeNext();
    return code;
  }

  readName(): string {
    const start = this.lastPos;
    if (!isNameStartChar(this.lastCode))
      this.unexpected('Name start expected');
    do {
      this.consumeNext();
    } while (isNameChar(this.lastCode));
    return String.fromCharCode(...this.input.slice(start, this.lastPos));
  }

  readText(): string {
    const start = this.nextPos;
    let code: number;
    do {
      code = this.consumeNext();
    } while (code !== -1 && code !== LT);
    const end = code === -1 ? this.nextPos : this.lastPos;
    return String.fromCharCode(...this.input.slice(start, end));
  }

  consumeNext(): number {
    this.lastPos = this.nextPos;
    if (this.nextPos >= this.input.length) return this.lastCode = -1;
    let word1 = this.input[this.nextPos++];
    if (word1 < 0xD800 || word1 >= 0xE000) return this.lastCode = word1;
    if (word1 >= 0xDC00) throw new Error(`orphan trailing surrogate 0x${word1.toString(16)} at index ${this.nextPos - 1}`);
    if (this.nextPos >= this.input.length) throw new Error(`unexpected end of input: orphan leading surrogate 0x${word1.toString(16)} at index ${this.nextPos - 1}`);
    let word2 = this.input[this.nextPos++];
    if (word2 < 0xD800 || word2 >= 0xE000) throw new Error(`expected trailing surrogate at index ${this.nextPos - 1}, found '${String.fromCharCode(word2)}'`);
    if (word2 < 0xDC00) throw new Error(`expected trailing surrogate at index ${this.nextPos - 1}, found leading surrogate 0x${word2.toString(16)}`);
    return this.lastCode = (0x10000 + (((word1 & 0x3FF) << 10) | (word2 & 0x3FF)));
  }

  unexpected(message: string) {
    const code = this.lastCode;
    if (code === -1)
      throw new Error(`${message}, found end of input`);
    else
      throw new Error(`${message}, found '${String.fromCodePoint(code)}' (0x${code.toString(16).toUpperCase()}) at ${this.lastPos}`);
  }
}
