import {CommentToken, DoctypeToken, Token} from '../tokens';
import {BaseComposer} from './BaseComposer';
import {InsertionMode} from './insertion-mode';

export class InitialComposer extends BaseComposer {
  initial(token: Token): InsertionMode {
    switch (token.type) {
      case 'comment':
        this.insertComment(token as CommentToken);
        return 'initial';
      case 'doctype':
        this.insertDoctype(token as DoctypeToken);
        // TODO set doctype of current document
        return 'beforeHtml';
      default:
        //whitespace is ignored on tokenizer level
        this.error('missing-doctype');
        return this.reprocessIn('beforeHtml', token);
    }
  }
}