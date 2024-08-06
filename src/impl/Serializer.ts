import {CDATASection, Comment, DocumentType, Element, Node, NodeType, ParentNode, ProcessingInstruction, TemplateElement, Text} from '../decl/dom-like.js';
import {CDataToken, CharactersToken, CommentToken, DoctypeToken, TagToken, Token} from './interfaces/tokens.js';
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

export const enum SelfClosingOptions {
  SKIP = 1,         // serialize in normal form, not self-closing
  KEEP_SKIP = 2,    // serialize original, fallback to normal form if unknown
  KEEP_APPLY = 3,   // serialize original, fallback to self-closing form
  APPLY = 4         // serialize in self-closing form, when possible
}

export interface SerializerOptions {
  htmlVoidSelfClose: SelfClosingOptions;
  foreignVoidSelfClose: SelfClosingOptions;
  escapeSingleQuoteInAttribute: boolean;
  omitEmptyAttributeValue: boolean;
  keepCDataSections: boolean;
}

export class Serializer {
  options: SerializerOptions;

  constructor(options?: Partial<SerializerOptions>) {
    this.options = {
      htmlVoidSelfClose: options?.htmlVoidSelfClose || SelfClosingOptions.SKIP,
      foreignVoidSelfClose: options?.foreignVoidSelfClose || SelfClosingOptions.KEEP_SKIP,
      escapeSingleQuoteInAttribute: options?.escapeSingleQuoteInAttribute || false,
      omitEmptyAttributeValue: options?.omitEmptyAttributeValue || false,
      keepCDataSections: options?.keepCDataSections || false
    }
  }

  serializeNode(node: Node): string {
    return this.serializeInChunks(node).join('');
  }

  serializeToken(token: Token): string | null {
    const chunks: string[] = [];
    switch (token.type) {
      case 'doctype':
        this.serializeDoctype(token as DoctypeToken, chunks);
        break;
      case 'startTag':
      case 'endTag':
        const tagToken = token as TagToken;
        this.serializeElementStart(tagToken, tagToken.name, tagToken.selfClosed, chunks, false);
        if (tagToken.type === 'endTag')
          chunks.splice(1, 0, '/');
        break;
      case 'comment':
        this.serializeComment(token as CommentToken, chunks);
        break;
      case 'characters':
        return (token as CharactersToken).data;
      case 'cdata':
        this.serializeCData(token as CDataToken, chunks);
        break;
      case 'eof':
        return null;
    }
    return chunks.join('');
  }

  serializeInChunks(node: Node, chunks: string[] = []): string[] {
    switch (node.nodeType) {
      case NodeType.ELEMENT_NODE:
        this.serializeElement(node as Element, chunks);
        break;
      case NodeType.TEXT_NODE:
        this.serializeText(node as Text, chunks);
        break;
      case NodeType.CDATA_SECTION_NODE:
        if (this.options.keepCDataSections)
          this.serializeCData(node as CDATASection, chunks);
        else
          this.serializeText(node as Text, chunks);
        break;
      case NodeType.PROCESSING_INSTRUCTION_NODE:
        this.serializePI(node as ProcessingInstruction, chunks);
        break;
      case NodeType.COMMENT_NODE:
        this.serializeComment(node as Comment, chunks);
        break;
      case NodeType.DOCUMENT_NODE:
      case NodeType.DOCUMENT_FRAGMENT_NODE:
        this.serializeContents(node as ParentNode, chunks);
        break;
      case NodeType.DOCUMENT_TYPE_NODE:
        this.serializeDoctype(node as DocumentType, chunks);
        break;
      default:
    }
    return chunks;
  }

  serializeElement(node: Element, chunks: string[]) {
    const tagName = node.localName;
    const isHtml = node.namespaceURI === NS_HTML;
    const isVoid = isHtml ? this.serializesAsVoid(node) : !node.hasChildNodes();
    let applySelfClosing: boolean, skipContents: boolean;
    if (!isVoid)
      applySelfClosing = skipContents = false;
    else if (isHtml) {
      applySelfClosing = this.shouldSelfCloseVoidElement(node.selfClosed, this.options.htmlVoidSelfClose);
      skipContents = true;
    } else
      skipContents = applySelfClosing = this.shouldSelfCloseVoidElement(node.selfClosed, this.options.foreignVoidSelfClose);
    this.serializeElementStart(node, tagName, applySelfClosing, chunks);
    if (!skipContents) {
      this.serializeContents(node, chunks);
      chunks.push('</');
      chunks.push(tagName);
      chunks.push('>');
    }
  }

  shouldSelfCloseVoidElement(selfClosed: boolean | undefined, option: SelfClosingOptions): boolean {
    switch (option) {
      case SelfClosingOptions.SKIP:
        return false;
      case SelfClosingOptions.KEEP_SKIP:
        return selfClosed || false;
      case SelfClosingOptions.KEEP_APPLY:
        return selfClosed === undefined ? true : selfClosed;
      case SelfClosingOptions.APPLY:
        return true;
    }
  }

  serializeElementStart(node: ElementLike, tagName: string, selfClosed: boolean, chunks: string[], escape: boolean = true) {
    chunks.push('<');
    chunks.push(tagName);
    for (let attr of node.attributes) {
      chunks.push(' ');
      chunks.push(attr.name);
      if (!this.options.omitEmptyAttributeValue || attr.value !== null) {
        chunks.push('="');
        chunks.push(escape ? this.escapeAttribute(attr.value || '') : (attr.value || ''));
        chunks.push('"');
      }
    }
    chunks.push(selfClosed ? '/>' : '>');
  }

  serializeContents(node: ParentNode, chunks: string[]) {
    if (node.nodeType === NodeType.ELEMENT_NODE && (node as Element).localName === 'template' && (node as Element).namespaceURI === NS_HTML) {
      this.serializeContents((node as TemplateElement).content, chunks);
    } else {
      for (let child of node.childNodes)
        this.serializeInChunks(child, chunks);
    }
  }

  serializeCData(node: DataLike, chunks: string[]) {
    chunks.push('<![CDATA[');
    chunks.push(node.data);
    chunks.push(']]>');
  }

  serializeText(node: Text, chunks: string[]) {
    if (node.parentElement && this.hasPlainText(node.parentElement))
      chunks.push(node.data);
    else
      chunks.push(this.escapeTextContents(node.data));
  }

  serializePI(node: ProcessingInstruction, chunks: string[]) {
    chunks.push('<?');
    chunks.push(node.target);
    if (node.data) {
      chunks.push(' ');
      chunks.push(node.data);
    }
    chunks.push('>');
  }

  serializeComment(node: DataLike, chunks: string[]) {
    chunks.push('<!--');
    chunks.push(node.data);
    chunks.push('-->');
  }

  serializeDoctype(node: DocumentTypeLike, chunks: string[]) {
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

  serializesAsVoid(node: Element): boolean {
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

  hasPlainText(node: Element): boolean {
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
  escapeTextContents(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('\u00A0', '&nbsp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
  }

  escapeAttribute(value: string): string {
    const result = value
        .replaceAll('&', '&amp;')
        .replaceAll('\u00A0', '&nbsp;')
        .replaceAll('"', '&quot;');
    return this.options.escapeSingleQuoteInAttribute ? result.replaceAll('\'', '&#39;') : result;
  }
}

export const TestSerializer = new Serializer({
  htmlVoidSelfClose: SelfClosingOptions.SKIP,
  foreignVoidSelfClose: SelfClosingOptions.KEEP_SKIP,
  escapeSingleQuoteInAttribute: false,
  omitEmptyAttributeValue: true,
  keepCDataSections: true
})

export const DefaultSerializer = new Serializer();