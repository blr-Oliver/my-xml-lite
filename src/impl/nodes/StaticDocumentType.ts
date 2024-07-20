import {DocumentType, NodeType} from '../../decl/xml-lite-decl';
import {StaticDocument} from './StaticDocument';
import {StaticEmptyNode} from './StaticEmptyNode';
import {StaticParentNode} from './StaticParentNode';

export class StaticDocumentType extends StaticEmptyNode implements DocumentType {
  declare readonly ownerDocument: StaticDocument;
  readonly name: string;
  readonly publicId: string;
  readonly systemId: string;

  constructor(parentNode: StaticParentNode | null, name: string, publicId: string, systemId: string) {
    super(NodeType.DOCUMENT_TYPE_NODE, parentNode);
    this.name = name;
    this.publicId = publicId;
    this.systemId = systemId;
  }
}