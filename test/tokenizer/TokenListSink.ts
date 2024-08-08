import {Token} from '../../src/impl/interfaces/tokens.js';
import {ComposerIntegration} from '../../src/impl/Tokenizer.js';
import {Element} from '../../src/interfaces/dom-types.js';

export class TokenListSink implements ComposerIntegration {
  tokens: Token[];
  adjustedCurrentNode: Element | null = null;
  inForeignContent: boolean = false;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  accept(token: Token) {
    this.tokens.push(token);
  }

  shouldUseForeignRules(): boolean {
    return this.inForeignContent;
  }
}