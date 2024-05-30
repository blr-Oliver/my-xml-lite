import {Document, DocumentType, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {StaticEmptyNode} from './StaticEmptyNode';

export class StaticDocumentType extends StaticEmptyNode implements DocumentType {
  readonly ownerDocument!: Document;
  readonly name: string;
  readonly publicId: string;
  readonly systemId: string;

  constructor(parentNode: ParentNode | null, name: string, publicId: string, systemId: string) {
    super(NodeType.DOCUMENT_TYPE_NODE, parentNode);
    this.name = name;
    this.publicId = publicId;
    this.systemId = systemId;
  }
}