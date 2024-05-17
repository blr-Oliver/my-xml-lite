import {DocumentType, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {StaticEmptyNode} from './StaticEmptyNode';

export class StaticDocumentType extends StaticEmptyNode implements DocumentType {
  readonly name: string;
  readonly publicId: string;
  readonly systemId: string;

  constructor(parentNode: ParentNode | null, parentIndex: number, name: string, publicId: string, systemId: string) {
    super(NodeType.DOCUMENT_TYPE_NODE, parentNode, parentIndex);
    this.name = name;
    this.publicId = publicId;
    this.systemId = systemId;
  }
}