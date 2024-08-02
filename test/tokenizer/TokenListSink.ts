import {Element} from '../../src/decl/dom-like.js';
import {Token} from '../../src/impl/interfaces/tokens.js';
import {ComposerIntegration} from '../../src/impl/Tokenizer.js';

export class TokenListSink implements ComposerIntegration {
  tokens: Token[];
  adjustedCurrentNode: Element | null = null;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  accept(token: Token) {
    this.tokens.push(token);
  }

  shouldUseForeignRules(): boolean {
    return false;
  }
}