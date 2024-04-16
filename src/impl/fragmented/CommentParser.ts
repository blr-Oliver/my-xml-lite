import {EOF, EXCLAMATION, GT, HYPHEN, LT, NUL, REPLACEMENT_CHAR} from '../../common/code-points';
import {ParserBase, State} from './common';

export abstract class CommentParser extends ParserBase {

  commentStart(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentStartDash';
      case GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emit({type: 'comment'}); // TODO emit comment
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
        this.emit({type: 'comment'}); // TODO emit comment
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emit({type: 'comment'}); // TODO emit comment
        this.emit(EOF);
        return 'eof';
      default:
        // TODO append HYPHEN to current comment
        return this.comment(code);
    }
  }

  comment(code: number): State {
    while (true) {
      switch (code) {
        case LT:
          // TODO append to buffer
          return 'commentLessThanSign';
        case HYPHEN:
          return 'commentEndDash';
        case EOF:
          this.error('eof-in-comment');
          this.emit({type: 'comment'}); // TODO emit comment
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          // TODO append code
          code = this.nextCode();
      }
    }
  }

  commentLessThanSign(code: number): State {
    while (true) {
      switch (code) {
        case EXCLAMATION:
          // TODO append to buffer
          return 'commentLessThanSignBang';
        case LT:
          // TODO append to buffer
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
        this.emit({type: 'comment'}); // TODO emit comment
        this.emit(EOF);
        return 'eof';
      default:
        // TODO append HYPHEN
        return this.comment(code);
    }
  }

  commentEnd(code: number): State {
    while (true) {
      switch (code) {
        case GT:
          this.emit({type: 'comment'}); // TODO emit comment;
          return 'data';
        case EXCLAMATION:
          return 'commentEndBang';
        case EOF:
          this.error('eof-in-comment');
          this.emit({type: 'comment'}); // TODO emit comment
          this.emit(EOF);
          return 'eof';
        case HYPHEN:
          // TODO append HYPHEN
          code = this.nextCode();
          break;
        default:
          // TODO append HYPHEN
          return this.comment(code);
      }
    }
  }

  commentEndBang(code: number): State {
    switch (code) {
      case HYPHEN:
        // TODO append to buffer: --!
        return 'commentEndDash';
      case GT:
        this.error('incorrectly-closed-comment');
        this.emit({type: 'comment'}); // TODO emit comment;
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emit({type: 'comment'}); // TODO emit comment
        this.emit(EOF);
        return 'eof';
      default:
        // TODO append to buffer: --!
        return this.comment(code);
    }
  }
}