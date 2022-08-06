import {CData, Comment, Element, Node, NodeContainer, ProcessingInstruction, Text, ValueNode} from './xml-node';

export function stringify(node: Node): string {
  const chunks: string[] = [];
  stringifyNode(node, chunks);
  return chunks.join('');
}

export type NodeStringifier<T extends Node> = (node: T, chunks: string[]) => void;
export const handlersPerType: { [type: string]: NodeStringifier<any> } = {
  'document': stringifyContents,
  'element': stringifyElement,
  'text': stringifyText,
  'comment': stringifyComment,
  'cdata': stringifyCData,
  'processing-instruction': stringifyPI
};

export function stringifyNode(node: Node, chunks: string[]) {
  handlersPerType[node.type](node, chunks);
}

export function stringifyContents(node: NodeContainer, chunks: string[]) {
  for (let childNode of node.childNodes)
    stringifyNode(childNode, chunks);
}

export function stringifyValueNode(node: ValueNode, prefix: string, suffix: string, chunks: string[]) {
  chunks.push(prefix, node.value, suffix);
}

export function stringifyText(node: Text, chunks: string[]) {
  chunks.push(node.value);
}

export function stringifyComment(node: Comment, chunks: string[]) {
  stringifyValueNode(node, '<!--', '-->', chunks);
}

export function stringifyCData(node: CData, chunks: string[]) {
  stringifyValueNode(node, '<![CDATA[', ']]>', chunks);
}

export function stringifyPI(node: ProcessingInstruction, chunks: string[]) {
  stringifyValueNode(node, '<?', '?>', chunks);
}

export function stringifyElement(node: Element, chunks: string[]) {
  chunks.push('<', node.name);
  for (let attrName in node.attributes) {
    let attrValue = node.attributes[attrName];
    chunks.push(' ', attrName);
    if (attrValue !== null)
      chunks.push('="', attrValue, '"');
  }
  if (node.empty)
    chunks.push('/>');
  else {
    chunks.push('>');
    stringifyContents(node, chunks);
    chunks.push('</', node.name, '>');
  }
}
