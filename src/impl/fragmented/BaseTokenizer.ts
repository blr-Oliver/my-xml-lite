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

  proceed() {
    let code: number = 0;
    while (this.active) {
      code = this.nextCode();
      if (code === EOC) break;
      this.state = this.callState(this.state, code);
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
  }
  protected emit(token: Token) {
    this.tokenQueue.push(token);
  }
  protected nextCode(): number {
    return this.env.input.next();
  }
  protected bogusComment(code: number): State {
    throw new TypeError('Malformed inheritance');
  }
  protected data(code: number): State {
    throw new TypeError('Malformed inheritance');
  }
  protected emitCurrentTag() {
    throw new TypeError('Malformed inheritance');
  }
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
      value: undefined
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

  protected callState(state: State, code: number): State {
    return this.execState(this.state = state, code);
  }
}