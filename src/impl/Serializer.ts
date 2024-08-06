import {CDATASection, Comment, DocumentType, Element, Node, NodeType, ParentNode, ProcessingInstruction, Text} from '../decl/dom-like.js';
import {CharactersToken, CommentToken, DoctypeToken, TagToken, Token} from './interfaces/tokens.js';
import {NS_HTML} from './TreeComposer.js';

type DocumentTypeLike = {
  name: string | undefined;
  publicId: string | undefined;
  systemId: string | undefined;
}

type ElementLike = {
  namespaceURI?: string | null;
  selfClosed?: boolean;
  attributes: {
    [Symbol.iterator](): IterableIterator<AttributeLike>
  }
}

type AttributeLike = {
  name: string;
  value: string | null;
}

type DataLike = {
  data: string;
}

export function serialize(node: Node): string {
  return serializeInChunks(node).join('');
}

export function serializeToken(token: Token): string | null {
  const chunks: string[] = [];
  switch (token.type) {
    case 'doctype':
      serializeDoctype(token as DoctypeToken, chunks);
      break;
    case 'startTag':
    case 'endTag':
      const tagToken = token as TagToken;
      serializeElementStart(tagToken, tagToken.name, tagToken.selfClosed, chunks, false);
      if (tagToken.type === 'endTag')
        chunks.splice(1, 0, '/');
      break;
    case 'comment':
      serializeComment(token as CommentToken, chunks);
      break;
    case 'characters':
      return (token as CharactersToken).data;
    case 'cdata':
      serializeCData(token as CommentToken, chunks);
      break;
    case 'eof':
      return null;
  }
  return chunks.join('');
}

function serializeInChunks(node: Node, chunks: string[] = []): string[] {
  switch (node.nodeType) {
    case NodeType.ELEMENT_NODE:
      serializeElement(node as Element, chunks);
      break;
    case NodeType.TEXT_NODE:
      serializeText(node as Text, chunks);
      break;
    case NodeType.CDATA_SECTION_NODE:
      serializeCData(node as CDATASection, chunks);
      break;
    case NodeType.PROCESSING_INSTRUCTION_NODE:
      serializePI(node as ProcessingInstruction, chunks);
      break;
    case NodeType.COMMENT_NODE:
      serializeComment(node as Comment, chunks);
      break;
    case NodeType.DOCUMENT_NODE:
    case NodeType.DOCUMENT_FRAGMENT_NODE:
      serializeContents(node as ParentNode, chunks);
      break;
    case NodeType.DOCUMENT_TYPE_NODE:
      serializeDoctype(node as DocumentType, chunks);
      break;
    default:
  }
  return chunks;
}

function serializeElement(node: Element, chunks: string[]) {
  const tagName = node.localName;
  const selfClosed = node.selfClosed || serializesAsVoid(node);
  serializeElementStart(node, tagName, selfClosed, chunks);
  if (!selfClosed) {
    serializeContents(node, chunks);
    chunks.push('</');
    chunks.push(tagName);
    chunks.push('>');
  }
}

function serializeElementStart(node: ElementLike, tagName: string, selfClosed: boolean, chunks: string[], escape: boolean = true) {
  chunks.push('<');
  chunks.push(tagName);
  for (let attr of node.attributes) {
    chunks.push(' ');
    chunks.push(attr.name);
    if (attr.value !== null) {
      chunks.push('="');
      chunks.push(escape ? escapeAttribute(attr.value) : attr.value);
      chunks.push('"');
    }
  }
  chunks.push(selfClosed ? '/>' : '>');
}

function serializeContents(node: ParentNode, chunks: string[]) {
  for (let child of node.childNodes)
    serializeInChunks(child, chunks);
}

function serializeCData(node: DataLike, chunks: string[]) {
  chunks.push('<![CDATA[');
  chunks.push(node.data);
  chunks.push(']]>');
}

function serializeText(node: Text, chunks: string[]) {
  if (node.parentElement && hasPlainText(node.parentElement))
    chunks.push(node.data);
  else
    chunks.push(escapeTextContents(node.data));
}

function serializePI(node: ProcessingInstruction, chunks: string[]) {
  chunks.push('<?');
  chunks.push(node.target);
  if (node.data) {
    chunks.push(' ');
    chunks.push(node.data);
  }
  chunks.push('>');
}

function serializeComment(node: DataLike, chunks: string[]) {
  chunks.push('<!--');
  chunks.push(node.data);
  chunks.push('-->');
}

function serializeDoctype(node: DocumentTypeLike, chunks: string[]) {
  chunks.push('<!DOCTYPE ');
  if (node.name !== undefined) {
    chunks.push(node.name);
    if (node.publicId) {
      chunks.push(' PUBLIC ');
      pushId(node.publicId);
      if (node.systemId) {
        chunks.push(' ');
        pushId(node.systemId);
      }
    } else if (node.systemId) {
      chunks.push(' SYSTEM ');
      pushId(node.systemId);
    }
  }
  chunks.push('>');

  function pushId(value: string) {
    if (value.indexOf('"') === -1) {
      chunks.push('"');
      chunks.push(value);
      chunks.push('"');
    } else if (value.indexOf('\'') === -1) {
      chunks.push('\'');
      chunks.push(value);
      chunks.push('\'');
    } else {
      chunks.push(value);
    }
  }
}

function serializesAsVoid(node: Element): boolean {
  if (node.namespaceURI !== NS_HTML) return false;
  switch (node.localName) {
    case 'area':
    case 'base':
    case 'basefont':
    case 'bgsound':
    case 'br':
    case 'col':
    case 'embed':
    case 'frame':
    case 'hr':
    case 'keygen':
    case 'img':
    case 'input':
    case 'link':
    case 'meta':
    case 'param':
    case 'source':
    case 'track':
    case 'wbr':
      return true;
    default:
      return false;
  }
}

function hasPlainText(node: Element): boolean {
  if (node.namespaceURI !== NS_HTML) return false;
  switch (node.localName) {
    case 'style':
    case 'script':
    case 'xmp':
    case 'iframe':
    case 'noembed':
    case 'noframes':
    case 'plaintext':
      return true;
    default:
      return false;
  }
}
function escapeTextContents(value: string): string {
  return value
      .replaceAll('&', '&amp;')
      .replaceAll('\u00A0', '&nbsp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return value
      .replaceAll('&', '&amp;')
      .replaceAll('\u00A0', '&nbsp;')
      .replaceAll('"', '&quot;')
}