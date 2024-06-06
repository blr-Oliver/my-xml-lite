import {CDATASection, Comment, DocumentType, Element, Node, NodeType, ParentNode, ProcessingInstruction, Text} from '../decl/xml-lite-decl';
import {NS_HTML} from './composer/BaseComposer';

export function serialize(node: Node): string {
  return serializeInChunks(node).join('');
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
  chunks.push('<');
  chunks.push(node.tagName);
  for (let attr of node.attributes) {
    chunks.push(' ');
    chunks.push(attr.name);
    if (attr.value !== null) {
      chunks.push('="');
      chunks.push(escapeAttribute(attr.value));
      chunks.push('"');
    }
  }
  if (node.selfClosed) {
    chunks.push('/>');
  } else if (serializesAsVoid(node)) {
    chunks.push('>');
  } else {
    chunks.push('>');
    serializeContents(node, chunks);
    chunks.push('</');
    chunks.push(node.tagName);
    chunks.push('>');
  }
}

function serializeContents(node: ParentNode, chunks: string[]) {
  for (let child of node.childNodes)
    serializeInChunks(child, chunks);
}

function serializeCData(node: CDATASection, chunks: string[]) {
  chunks.push('<[[CDATA[');
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

function serializeComment(node: Comment, chunks: string[]) {
  chunks.push('<!--');
  chunks.push(node.data);
  chunks.push('-->');
}

function serializeDoctype(node: DocumentType, chunks: string[]) {
  chunks.push('<!DOCTYPE ');
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
  switch (node.tagName) {
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
  switch (node.tagName) {
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
      .replaceAll('<', '&gt;');
}

function escapeAttribute(value: string): string {
  return value
      .replaceAll('&', '&amp;')
      .replaceAll('\u00A0', '&nbsp;')
      .replaceAll('"', '&quot;')
}