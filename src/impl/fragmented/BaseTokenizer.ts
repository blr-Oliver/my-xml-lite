import {EOC} from '../../common/code-points';
import {ParserEnvironment} from '../../decl/ParserEnvironment';
import {Attribute, CommentToken, TagToken, TextToken, Token} from '../tokens';
import {State} from './states';

export abstract class BaseTokenizer {
  env!: ParserEnvironment;
  state!: State;
  returnState!: State;
  inAttribute!: boolean;
  currentComment!: CommentToken;
  currentTag!: TagToken;
  currentAttribute!: Attribute;

  proceed() {
    // TODO imply possibility of changing state BEFORE state handler returned
    let code: number = 0;
    while (this.state) {
      code = this.nextCode();
      if (code === EOC) break;
      this.state = this.callState(this.state, code);
    }
  }

  protected error(name: string) {
  }
  protected emit(token: Token) {
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
    this.state = state;
    // @ts-ignore
    return this[state](code);
  }
}