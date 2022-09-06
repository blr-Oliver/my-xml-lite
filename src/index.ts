import {document} from './parser';
import {
  ArrayCharacterSource,
  BufferedStringSource,
  CharacterSource,
  Resettable,
  StringSource,
  UTF16NonValidatingCharacterSource,
  UTF16ValidatingCharacterSource,
  UTF8NonValidatingCharacterSource
} from './stream-source';
import {stringify} from './stringifier';
import {
  CData,
  Comment,
  Document,
  Element,
  NamedNode,
  Node,
  NodeContainer,
  NodeType,
  ProcessingInstruction,
  Text,
  textContent,
  textNodes,
  ValueNode
} from './xml-node';

export {
  // stream-source
  CharacterSource,
  Resettable,
  StringSource,
  BufferedStringSource,
  ArrayCharacterSource,
  UTF16NonValidatingCharacterSource,
  UTF16ValidatingCharacterSource,
  UTF8NonValidatingCharacterSource,
  // xml-node
  NodeType,
  Node,
  NodeContainer,
  Document,
  NamedNode,
  ValueNode,
  Element,
  Text,
  Comment,
  CData,
  ProcessingInstruction,
  textContent,
  textNodes
}

function parse(input: ArrayBuffer | string | StringSource): Document {
  return document(createSource(input));
}

function createSource(input: ArrayBuffer | string | StringSource): StringSource {
  if (input instanceof ArrayBuffer)
    return new BufferedStringSource(new UTF8NonValidatingCharacterSource(new Uint8Array(input)));
  if (typeof input === 'string')
    return new BufferedStringSource(new UTF16NonValidatingCharacterSource(stringToUTF16Array(input)));
  return input as StringSource;
}

function stringToUTF16Array(s: string): Uint16Array {
  return Uint16Array.from(Array(s.length), (_, i) => s.charCodeAt(i));
}

export const XML = {
  parse,
  stringify
}