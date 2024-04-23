import {EOF, EXCLAMATION, GT, HYPHEN, LT, NUL, REPLACEMENT_CHAR} from '../../common/code-points';
import {CommentToken, EOF_TOKEN} from '../tokens';
import {State} from './states';
import {BaseTokenizer} from './BaseTokenizer';

export abstract class CommentParser extends BaseTokenizer {
  private currentComment!: CommentToken;

  commentStart(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentStartDash';
      case GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return 'data';
      default:
        return this.comment(code);
    }
  }

  commentStartDash(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentEnd';
      case GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        this.env.buffer.append(HYPHEN);
        return this.comment(code);
    }
  }

  comment(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case LT:
          buffer.append(code);
          return 'commentLessThanSign';
        case HYPHEN:
          return 'commentEndDash';
        case EOF:
          this.error('eof-in-comment');
          this.emitCurrentComment();
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  commentLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case EXCLAMATION:
          buffer.append(code);
          return 'commentLessThanSignBang';
        case LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          return this.comment(code);
      }
    }
  }

  commentLessThanSignBang(code: number): State {
    if (code === HYPHEN)
      return 'commentLessThanSignBangDash';
    else
      return this.comment(code);
  }

  commentLessThanSignBangDash(code: number): State {
    if (code === HYPHEN)
      return 'commentLessThanSignBangDashDash';
    else
      return this.commentEndDash(code);
  }

  commentLessThanSignBangDashDash(code: number): State {
    if (code !== GT && code !== EOF)
      this.error('nested-comment');
    return this.commentEnd(code);
  }

  commentEndDash(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentEnd';
      case EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        this.env.buffer.append(HYPHEN);
        return this.comment(code);
    }
  }

  commentEnd(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case GT:
          this.emitCurrentComment();
          return 'data';
        case EXCLAMATION:
          return 'commentEndBang';
        case EOF:
          this.error('eof-in-comment');
          this.emitCurrentComment();
          this.emit(EOF_TOKEN);
          return 'eof';
        case HYPHEN:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          buffer.append(HYPHEN);
          buffer.append(HYPHEN);
          return this.comment(code);
      }
    }
  }

  commentEndBang(code: number): State {
    const buffer = this.env.buffer;
    const data = buffer.buffer;
    let position: number;
    switch (code) {
      case HYPHEN:
        // TODO this might be good variant overload candidate
        position = buffer.position;
        data[position++] = HYPHEN;
        data[position++] = HYPHEN;
        data[position++] = EXCLAMATION;
        buffer.position += 3;
        return 'commentEndDash';
      case GT:
        this.error('incorrectly-closed-comment');
        this.emitCurrentComment();
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        position = buffer.position;
        data[position++] = HYPHEN;
        data[position++] = HYPHEN;
        data[position++] = EXCLAMATION;
        buffer.position += 3;
        return this.comment(code);
    }
  }

  private emitCurrentComment() {
    this.currentComment.data = this.env.buffer.takeString();
    this.emit(this.currentComment);
    // @ts-ignore
    this.currentComment = undefined;
  }
}