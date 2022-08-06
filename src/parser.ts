import {StringSource} from './stream-source';
import {Document, Element, NamedNode, Node, NodeContainer, NodeType, Text, ValueNode} from './xml-node';

const ALWAYS_EMPTY: { [tag: string]: boolean } = {
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  keygen: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true
};

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

export function document(source: StringSource): Document {
  const doc = {
    type: 'document',
    childNodes: [],
    children: []
  } as Document;
  elementContents(source, doc);
  return doc;
}

/**
 @return name of closing tag (with relaxed closing - not necessarily matching enclosing tag)
 */
export function elementContents(source: StringSource, parent: NodeContainer): string | void {
  while (source.get() !== -1) {
    text(source, parent);
    if (source.get() === LT) {
      let closingTagName = lt(source, parent);
      if (closingTagName) return closingTagName;
    } else {
      // this normally happens only for top level node, i.e. document
    }
  }
}

export function text(source: StringSource, parent: NodeContainer): void {
  let code: number = source.next();
  if (code === -1 || code === LT) return;
  source.start();
  let blank = true;
  while (code !== -1 && code !== LT) {
    code = source.next();
    blank = blank && isSpace(code);
  }
  const value = source.end();
  if (value !== '')
    addNode(parent, {
      type: 'text',
      value,
      blank
    } as Text);
}
/**
 * Handle opening angle bracket. It may close an element, or open a new non-text node.
 *
 * @return name of the closing tag or name of tag being improperly closed or nothing if any node opened by this is properly closed.
 */

export function lt(source: StringSource, parent: NodeContainer): string | void {
  let code = source.next();
  if (code === SLASH) return closingTag(source);
  else if (code === QUESTION) pi(source, parent);
  else if (code === EXCLAMATION) commentOrCdata(source, parent);
  else if (isNameChar(code) || isSpace(code)) return element(source, parent);
  else unexpected(source, `Expected valid markup or name`);
}

export function addNode(parent: NodeContainer, node: Node) {
  node.parent = parent;
  parent.childNodes.push(node);
  if (node.type === 'element')
    parent.children.push(node as Element);
}

export function closingTag(source: StringSource): string {
  source.next();
  skipSpace(source);
  const name = readName(source);
  if (skipSpace(source) !== GT) unexpected(source, `Expected '>'`);
  return name;
}

/**
 * @return name of element it improperly closes or nothing if properly closed
 */
export function element(source: StringSource, parent: NodeContainer): string | void {
  skipSpace(source);
  const name = readName(source);
  const element = {
    type: 'element',
    name,
    empty: false,
    attributes: {},
    childNodes: [],
    children: []
  } as Element;
  addNode(parent, element);
  while (isSpace(source.get())) {
    skipSpace(source);
    if (isNameChar(source.get()))
      attribute(source, element);
    else break;
  }
  if (source.get() === SLASH) {
    if (source.next() !== GT) unexpected(source, `Expected '>'`);
    element.empty = true;
    return;
  } else {
    if (source.get() !== GT) unexpected(source, `Expected valid markup or name`);
    const lcName = name.toLowerCase();
    if (lcName in ALWAYS_EMPTY && ALWAYS_EMPTY[lcName]) {
      element.empty = true;
      return;
    }
    const closingName = elementContents(source, element);
    if (closingName !== name) return closingName;
  }
}

export function attribute(source: StringSource, node: NamedNode) {
  // TODO duplicate attributes
  const name = readName(source);
  skipSpace(source);
  let value: string | null = null;
  if (source.get() === EQ) {
    source.next();
    skipSpace(source);
    const startQuote = source.start();
    if (startQuote !== QUOTE && startQuote !== DQUOTE) unexpected(source, `Expected single (') or double quote (")`);
    source.next();
    const endQuote = skipTo(source, startQuote);
    if (startQuote !== endQuote) unexpected(source, `Expected matching quote (${startQuote})`);
    value = source.end(1);
    source.next();
  }
  node.attributes[name] = value;
}

export function commentOrCdata(source: StringSource, parent: NodeContainer) {
  const code = source.next();
  if (code === CMT_START[2]) comment(source, parent);
  else if (code === CD_START[2]) cdata(source, parent);
  else unexpected(source, 'Expected comment or CDATA section start');
}

export function comment(source: StringSource, parent: NodeContainer) {
  borderedValueNode(source, parent, 'comment', CMT_START, CMT_END, 3);
}

export function cdata(source: StringSource, parent: NodeContainer) {
  borderedValueNode(source, parent, 'cdata', CD_START, CD_END, 3);
}

export function pi(source: StringSource, parent: NodeContainer) {
  borderedValueNode(source, parent, 'processing-instruction', PI_START, PI_END, 2);
}

export function borderedValueNode(source: StringSource, parent: NodeContainer, type: NodeType, startSeq: number[], endSeq: number[], startOffset: number) {
  const node = {type} as ValueNode;
  for (let i = startOffset; i < startSeq.length; ++i)
    if (source.next() !== startSeq[i]) unexpected(source, `Expected '${String.fromCodePoint(...startSeq)}'`);
  source.start();
  if (skipToSeq(source, endSeq) === -1) unexpected(source, `Expected '${String.fromCodePoint(...endSeq)}'`);
  node.value = source.end(1, endSeq.length - 1);
  addNode(parent, node);
}

export function skipTo(source: StringSource, terminator: number): number {
  let code: number = source.get();
  while (code !== -1 && code !== terminator)
    code = source.next();
  return code;
}

export function skipToSeq(source: StringSource, seq: number[]): number {
  const indexes = Array(seq.length);
  let size = 0;
  let code: number;
  while ((code = source.next()) !== -1) {
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

export function skipSpace(source: StringSource): number {
  let code = source.get();
  while (isSpace(code))
    code = source.next();
  return code;
}

export function readName(source: StringSource): string {
  source.start();
  if (!isNameStartChar(source.get()))
    unexpected(source, 'Name start expected');
  let code;
  do {
    code = source.next();
  } while (isNameChar(code));
  return source.end();
}

export function unexpected(source: StringSource, message: string) {
  const code = source.get();
  if (code === -1)
    throw new Error(`${message}, found end of input`);
  else
    throw new Error(`${message}, found '${String.fromCodePoint(code)}' (0x${code.toString(16).toUpperCase()})`);
}
