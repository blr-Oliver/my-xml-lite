import {CData, Comment, Element, Node, NodeContainer, ProcessingInstruction, Text, ValueNode} from './xml-node';

export function stringify(node: Node): string {
  const chunks: string[] = [];
  stringifyNode(node, chunks);
  return chunks.join('');
}

type NodeStringifier<T extends Node> = (node: T, chunks: string[]) => void;
const handlersPerType: { [type: string]: NodeStringifier<any> } = {
  'document': stringifyContents,
  'element': stringifyElement,
  'text': stringifyText,
  'comment': stringifyComment,
  'cdata': stringifyCData,
  'processing-instruction': stringifyPI
};

function stringifyNode(node: Node, chunks: string[]) {
  handlersPerType[node.type](node, chunks);
}

function stringifyContents(node: NodeContainer, chunks: string[]) {
  for (let childNode of node.childNodes)
    stringifyNode(childNode, chunks);
}

function stringifyValueNode(node: ValueNode, prefix: string, suffix: string, chunks: string[]) {
  chunks.push(prefix, node.value, suffix);
}

function stringifyText(node: Text, chunks: string[]) {
  chunks.push(node.value);
}

function stringifyComment(node: Comment, chunks: string[]) {
  stringifyValueNode(node, '<!--', '-->', chunks);
}

function stringifyCData(node: CData, chunks: string[]) {
  stringifyValueNode(node, '<![CDATA[', ']]>', chunks);
}

function stringifyPI(node: ProcessingInstruction, chunks: string[]) {
  stringifyValueNode(node, '<?', '?>', chunks);
}

function stringifyElement(node: Element, chunks: string[]) {
  chunks.push('<', node.name);
  for (let attrName in node.attributes) {
    chunks.push(' ', attrName);
    const attrValue = node.attributes[attrName];
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
