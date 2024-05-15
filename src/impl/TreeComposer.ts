import {TokenSink} from '../decl/ParserEnvironment';
import {XMLLite} from '../decl/xml-lite-decl';
import {InsertionMode} from './insertion-mode';
import {Token} from './tokens';
import Document = XMLLite.Document;
import Node = XMLLite.Node;

/*
  no script execution
  quirks mode is never enabled
  template is treated as ordinary element
  formatting elements are ignored
*/
export class TreeComposer implements TokenSink {
  insertionMode: InsertionMode = 'initial';
  originalInsertionMode!: InsertionMode;

  context?: Node;
  nodeStack: Node[] = [];
  document!: Document;

  accept(token: Token) {
  }

  initial(token: Token): InsertionMode {
    switch (token.type) {
      case 'doctype':
        break;
      case 'comment':
        break;
      case 'startTag':
        break;
      case 'endTag':
        break;
      case 'characters':
        return 'initial';
    }
    return 'initial';
  }

  beforeHtml(token: Token): InsertionMode {
    switch (token.type) {
      case 'doctype':
        return 'beforeHtml';
    }
    return 'beforeHtml';
  }
}