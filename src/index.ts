import {HtmlLiteFactory} from './impl/HtmlLiteFactory.js';
import {HTML_SPECIAL} from './interfaces/named-character-refs.js';

export {CharacterSource} from './interfaces/CharacterSource.js';
export {CodePoints} from './interfaces/CodePoints.js';
export {EntityMapping} from './interfaces/EntityMapping.js';
export {ErrorHandler} from './interfaces/ErrorHandler.js';
export {NodeFactory} from './interfaces/NodeFactory.js';
export {Parser} from './interfaces/Parser.js';
export {ParserFactory} from './interfaces/ParserFactory.js';
export {PrefixNode} from './interfaces/PrefixNode.js';
export {Resettable} from './interfaces/Resettable.js';
export {
  Attr,
  CDATASection,
  CharacterData,
  ChildNode,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  DOMTokenList,
  Element,
  HTMLCollection,
  NamedNodeMap,
  Node,
  NodeFilter,
  NodeIterator,
  NodeListOf,
  NodeType,
  NonDocumentTypeChildNode,
  NonElementParentNode,
  ParentNode,
  ProcessingInstruction,
  TemplateElement,
  Text,
  TreeWalker
} from './interfaces/dom-types.js';
export {HTML_SPECIAL} from './interfaces/named-character-refs.js';
export {HtmlLiteFactory} from './impl/HtmlLiteFactory.js';

export const HtmlLite = new HtmlLiteFactory();