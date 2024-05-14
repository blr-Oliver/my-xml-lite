import {isSpace} from '../common/code-checks';
import {CodePoints} from '../common/code-points';
import {CD_END, CD_START, CMT_END, CMT_START, PI_END, PI_START, stringToArray} from '../common/code-sequences';
import {StringSource} from '../common/stream-source';
import {isNameChar, isNameStartChar} from '../common/xml-code-checks';
import {Declaration, Document, Element, Node, NodeContainer, NodeType, Text, ValueNode} from '../common/xml-node';

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

const NO_CHILDREN: { [tag: string]: boolean } = {
  script: true
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
function elementContents(source: StringSource, parent: NodeContainer): string | void {
  while (source.get() !== -1) {
    text(source, parent);
    if (source.get() === CodePoints.LT) {
      let closingTagName = lt(source, parent);
      if (closingTagName) return closingTagName;
    } else {
      // this normally happens only for top level node, i.e. document
    }
  }
}

function text(source: StringSource, parent: NodeContainer): void {
  let code: number = source.next();
  if (code === -1 || code === CodePoints.LT) return;
  source.start();
  let blank = true;
  while (code !== -1 && code !== CodePoints.LT) {
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

function lt(source: StringSource, parent: NodeContainer): string | void {
  let code = source.next();
  if (code === CodePoints.SLASH) {
    const name = closingTag(source);
    if (ALWAYS_EMPTY[name.toLowerCase()])
      return;
    return name;
  } else if (code === CodePoints.QUESTION) pi(source, parent);
  else if (code === CodePoints.EXCLAMATION) exclamation(source, parent);
  else if (isNameChar(code) || isSpace(code)) return element(source, parent);
  else unexpected(source, `Expected valid markup or name`);
}

function addNode(parent: NodeContainer, node: Node) {
  node.parent = parent;
  parent.childNodes.push(node);
  if (node.type === 'element')
    parent.children.push(node as Element);
}

function closingTag(source: StringSource): string {
  source.next();
  skipSpace(source);
  const name = readName(source);
  if (skipSpace(source) !== CodePoints.GT) unexpected(source, `Expected '>'`);
  return name;
}

/**
 * @return name of element it improperly closes or nothing if properly closed
 */
function element(source: StringSource, parent: NodeContainer): string | void {
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
  if (source.get() === CodePoints.SLASH) {
    if (source.next() !== CodePoints.GT) unexpected(source, `Expected '>'`);
    element.empty = true;
    return;
  } else {
    if (source.get() !== CodePoints.GT) unexpected(source, `Expected valid markup or name`);
    const lcName = name.toLowerCase();
    if (ALWAYS_EMPTY[lcName]) {
      element.empty = true;
      return;
    }
    let closingName: string | void;
    if (NO_CHILDREN[lcName]) {
      source.start();
      skipToSeq(source, [CodePoints.LT, CodePoints.SLASH]);
      addNode(element, {
        type: 'text',
        blank: false, // TODO
        value: source.end(1, 2)
      } as Text);
      closingName = closingTag(source);
    } else {
      closingName = elementContents(source, element);
    }
    if (closingName !== name) return closingName;
  }
}

function attribute(source: StringSource, node: Element) {
  // TODO duplicate attributes
  const name = readName(source);
  skipSpace(source);
  let value: string | null = null;
  if (source.get() === CodePoints.EQ) {
    source.next();
    skipSpace(source);
    const startQuote = source.start();
    if (startQuote === CodePoints.AMPERSAND) {
      // let all bears of deepest woods drill creator of this fucking invalid XML shit
      value = attributeWithEntityQuote(source);
    } else {
      if (startQuote !== CodePoints.SINGLE_QUOTE && startQuote !== CodePoints.DOUBLE_QUOTE) unexpected(source, `Expected single (') or double quote (")`);
      source.next();
      const endQuote = skipTo(source, startQuote);
      if (startQuote !== endQuote) unexpected(source, `Expected matching quote (${startQuote})`);
      value = source.end(1);
      source.next();
    }
  }
  node.attributes[name] = value;
}

function attributeWithEntityQuote(source: StringSource): string {
  skipTo(source, CodePoints.SEMICOLON);
  source.next();
  const entity = source.end();
  source.start();
  const endMarker = skipToSeq(source, stringToArray(entity));
  if (endMarker !== CodePoints.SEMICOLON) unexpected(source, `Expected same closing entity ${entity}`);
  source.next();
  return source.end(0, entity.length);
}

function exclamation(source: StringSource, parent: NodeContainer) {
  const code = source.next();
  if (code === CMT_START[2]) comment(source, parent);
  else if (code === CD_START[2]) cdata(source, parent);
  else if (isNameStartChar(code)) declaration(source, parent);
  else unexpected(source, 'Expected comment, declaration or CDATA section start');
}

function comment(source: StringSource, parent: NodeContainer) {
  borderedValueNode(source, parent, 'comment', CMT_START, CMT_END, 3);
}

function cdata(source: StringSource, parent: NodeContainer) {
  borderedValueNode(source, parent, 'cdata', CD_START, CD_END, 3);
}

function pi(source: StringSource, parent: NodeContainer) {
  borderedValueNode(source, parent, 'processing-instruction', PI_START, PI_END, 2);
}

function declaration(source: StringSource, parent: NodeContainer) {
  const declType = readName(source);
  skipSpace(source);
  source.start();
  let level = 1;
  let code: number = source.get();
  while (level > 0 && code !== -1) {
    if (code === CodePoints.LT) ++level;
    else if (code === CodePoints.GT) --level;
    code = source.next();
  }
  addNode(parent, {
    type: 'declaration',
    declType,
    value: source.end(0, 1)
  } as Declaration);
}

function borderedValueNode(source: StringSource, parent: NodeContainer, type: NodeType, startSeq: number[], endSeq: number[], startOffset: number) {
  const node = {type} as ValueNode;
  for (let i = startOffset; i < startSeq.length; ++i)
    if (source.next() !== startSeq[i]) unexpected(source, `Expected '${String.fromCodePoint(...startSeq)}'`);
  source.start();
  if (skipToSeq(source, endSeq) === -1) unexpected(source, `Expected '${String.fromCodePoint(...endSeq)}'`);
  node.value = source.end(1, endSeq.length - 1);
  addNode(parent, node);
}

function skipTo(source: StringSource, terminator: number): number {
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

function skipSpace(source: StringSource): number {
  let code = source.get();
  while (isSpace(code))
    code = source.next();
  return code;
}

function readName(source: StringSource): string {
  source.start();
  if (!isNameStartChar(source.get()))
    unexpected(source, 'Name start expected');
  let code;
  do {
    code = source.next();
  } while (isNameChar(code));
  return source.end();
}

function unexpected(source: StringSource, message: string) {
  const code = source.get();
  if (code === -1)
    throw new Error(`${message}, found end of input`);
  else
    throw new Error(`${message}, found '${String.fromCodePoint(code)}' (0x${code.toString(16).toUpperCase()})`);
}
