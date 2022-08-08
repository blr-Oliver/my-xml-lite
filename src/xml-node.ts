export type NodeType = 'document' | 'element' | 'text' | 'comment' | 'cdata' | 'processing-instruction';

export interface Node {
  type: NodeType;
  parent?: NodeContainer;
}

export interface NodeContainer extends Node {
  childNodes: Node[];
  children: Element[];
}

export interface Document extends NodeContainer {
  type: 'document';
}

export interface NamedNode extends Node {
  name: string;
  attributes: { [key: string]: string | null };
}

export interface ValueNode extends Node {
  value: string;
}

export interface Element extends NamedNode, NodeContainer {
  type: 'element';
  empty: boolean;
}

export interface Text extends ValueNode {
  type: 'text';
  blank: boolean;
}

export interface Comment extends ValueNode {
  type: 'comment';
}

export interface CData extends ValueNode {
  type: 'cdata';
}

export interface ProcessingInstruction extends ValueNode {
  type: 'processing-instruction';
}

const verbatimJoiner: (chunks: Text[]) => string =
    chunks => chunks.map(text => text.value).join('');
const trimmingJoiner: (chunks: Text[]) => string =
    chunks => chunks
        .filter((text, i, all) => !text.blank || (i > 0 && !all[i - 1].blank))
        .map(text => text.blank ? ' ' : text.value.trim())
        .join('')
        .trim();

export function textContent(node: Node, trim: boolean = false): string {
  const joiner: (chunks: Text[]) => string = trim ? trimmingJoiner : verbatimJoiner;
  switch (node.type) {
    case 'text':
      return (node as Text).value;
    case 'document':
    case 'element':
      return joiner(textNodes(node as NodeContainer));
    default:
      return '';
  }
}

export function textNodes(node: NodeContainer, chunks: Text[] = []): Text[] {
  for (let childNode of node.childNodes) {
    switch (childNode.type) {
      case 'text':
        chunks.push(childNode as Text);
        break;
      case 'element':
        textNodes(childNode as Element, chunks);
        break;
    }
  }
  return chunks;
}
