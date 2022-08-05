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

export function textContent(node: Node): string {
  switch (node.type) {
    case 'text':
    case 'comment':
    case 'cdata':
    case 'document':
    case 'element':
      return collectTextNodesFlat(node as NodeContainer)
          .map(text => text.value)
          .join('');
    case 'processing-instruction':
      return '';
    default:
      return '';
  }
}

function collectTextNodesFlat(node: NodeContainer, chunks: Text[] = []): Text[] {
  for (let childNode of node.childNodes) {
    switch (childNode.type) {
      case 'text':
        chunks.push(childNode as Text);
        break;
      case 'element':
        collectTextNodesFlat(childNode as Element, chunks);
        break;
    }
  }
  return chunks;
}
