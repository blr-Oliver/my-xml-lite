import {EOC} from '../../common/code-points';
import {ParserEnvironment} from '../../decl/ParserEnvironment';
import {Attribute, CommentToken, EOF_TOKEN, TagToken, TextToken, Token} from '../tokens';
import {State} from './states';

export abstract class BaseTokenizer {
  env!: ParserEnvironment;
  state: State = 'data';
  active: boolean = true;
  tokenQueue: Token[] = [];

  returnState!: State;
  inAttribute!: boolean;
  currentComment!: CommentToken;
  currentTag!: TagToken;
  currentAttribute!: Attribute;

  sequenceBufferOffset!: number;

  proceed() {
    let code: number = 0;
    while (this.active) {
      code = this.nextCode();
      if (code === EOC) break;
      this.state = this.execState(this.state, code);
      this.commitTokens();
    }
  }
  private execState(state: State, code: number): State {
    // @ts-ignore
    return this[state](code);
  }
  private commitTokens() {
    // TODO this looks strange
    const sink = this.env.tokens;
    if (sink) {
      for (let i = 0; i < this.tokenQueue.length; ++i)
        sink.accept(this.tokenQueue[i]);
    }
    this.tokenQueue.length = 0;
  }

  protected error(name: string) {
    this.env.errors.push(name);
  }
  protected emit(token: Token) {
    this.tokenQueue.push(token);
  }
  protected nextCode(): number {
    return this.env.input.next();
  }
  protected emitCurrentTag() {
    throw new TypeError('Malformed inheritance');
  }
  /**
   Initiates "sequence matching" mode. In this mode input is checked against provided sequence, verbatim or case-insensitive.
   Sequence mode either completes "positively" when input completely matches the expected sequence or exits "negatively" when first difference occurs.
   In both outcomes all processed characters are appended to the accumulating buffer verbatim (even in case-insensitive mode).
   During this mode the parser state is "sequence" and several fields track information about the process.

   @param code current input character
   @param seq the sequence to check input against
   @param caseInsensitive match ASCII upper alpha characters from input as they were lower alpha
   @param positiveState state to continue when the sequence is confirmed; first character in that state will be the character immediately AFTER the sequence
   @param negativeState state to continue when the sequence is failed; first character in that state will be the first character that differs
   */
  protected matchSequence(code: number, seq: readonly number[], caseInsensitive: boolean, positiveState: State, negativeState: State): State {
    throw new TypeError('Malformed inheritance');
  }
  protected eof(): State {
    this.emit(EOF_TOKEN);
    this.active = false;
    return 'eof';
  }
  protected startNewComment() {
    this.currentComment = {
      type: 'comment',
      data: ''
    };
  }

  protected startNewTag(name: string = '') {
    this.currentTag = {
      name,
      type: 'startTag',
      selfClosing: false,
      attributes: []
    }
  }

  protected startNewAttribute() {
    this.currentTag.attributes.push(this.currentAttribute = {
      name: '',
      value: null
    });
  }

  protected emitAccumulatedCharacters() {
    const buffer = this.env.buffer;
    if (buffer.position) {
      this.emit({
        type: 'characters',
        data: buffer.takeString()
      } as TextToken);
    }
  }
  // TODO inline this for static transitions
  protected callState(state: State, code: number): State {
    return this.execState(this.state = state, code);
  }
}