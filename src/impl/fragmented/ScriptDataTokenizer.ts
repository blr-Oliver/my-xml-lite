import {
  EOF,
  EXCLAMATION,
  FF,
  GT,
  HYPHEN,
  isAsciiAlpha,
  isAsciiLowerAlpha,
  isAsciiUpperAlpha,
  LF,
  LT,
  NUL,
  REPLACEMENT_CHAR,
  SOLIDUS,
  SPACE,
  TAB
} from '../../common/code-points';
import {State} from './states';
import {TextTokenizer} from './TextTokenizer';

// @formatter:off
/**
 `<script>` element parser.

 Everything inside is treated as text, no nested elements allowed. However, fake "comments" (enclosed in `<!--` and `-->`) are possible inside. And
 especially the so called "double escaped" state when `<script>` is located inside fake comment.

 There are 3 major states:
 <pre>
 1. script data
    - enters "script data escaped" after `<!--`
    - exits back to "data" after an end `</script>` tag
 2. script data escaped: after `<!--`
    - returns to "script data" after `-->`
    - enters "script data double escaped" after a start `<script>` tag
    - exits back to "data" after an end `</script>` tag
 3. script data double escaped: after `<!--` AND start `<script>` tag
    - returns to "script data" after `-->`
    - returns to "script data escaped" after an end `</script>` tag
 </pre>
 */
// @formatter:on
export abstract class ScriptDataTokenizer extends TextTokenizer {
  scriptData(code: number): State {
    return this.textDataNoRefs(code, 'scriptDataLessThanSign');
  }

  scriptDataLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case SOLIDUS:
        return 'scriptDataEndTagOpen';
      case EXCLAMATION:
        buffer.append(LT);
        buffer.append(EXCLAMATION);
        return 'scriptDataEscapeStart';
      default:
        buffer.append(LT);
        return this.scriptData(code);
    }
  }

  scriptDataEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'scriptDataEndTagName', 'scriptData');
  }

  scriptDataEndTagName(code: number): State {
    return this.expectAsciiEndTag(code, 'script', 'scriptData');
  }

  scriptDataEscapeStart(code: number): State {
    if (code === HYPHEN) {
      this.env.buffer.append(code);
      return 'scriptDataEscapeStartDash';
    } else
      return this.scriptData(code);
  }

  scriptDataEscapeStartDash(code: number): State {
    if (code === HYPHEN) {
      this.env.buffer.append(code);
      return 'scriptDataEscapedDashDash';
    } else
      return this.scriptData(code);
  }

  scriptDataEscaped(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          return 'scriptDataEscapedDash';
        case LT:
          return 'scriptDataEscapedLessThanSign';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  scriptDataEscapedDash(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case HYPHEN:
        buffer.append(code);
        return 'scriptDataEscapedDashDash';
      case LT:
        return 'scriptDataEscapedLessThanSign';
      case EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      case NUL:
        this.error('unexpected-null-character');
        code = REPLACEMENT_CHAR;
      default:
        buffer.append(code);
        return 'scriptDataEscaped';
    }
  }

  scriptDataEscapedDashDash(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          code = this.nextCode();
          break;
        case LT:
          return 'scriptDataEscapedLessThanSign';
        case GT:
          buffer.append(code);
          return 'scriptData';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          return 'scriptDataEscaped';
      }
    }
  }

  scriptDataEscapedLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    if (code === SOLIDUS) {
      return 'scriptDataEscapedEndTagOpen';
    } else if (isAsciiAlpha(code)) {
      this.emitAccumulatedCharacters();
      buffer.append(LT);
      return this.scriptDataDoubleEscapeStart(code);
    } else {
      buffer.append(LT);
      return this.scriptDataEscaped(code);
    }
  }

  scriptDataEscapedEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'scriptDataEscapedEndTagName', 'scriptDataEscaped')
  }

  scriptDataEscapedEndTagName(code: number): State {
    return this.expectAsciiEndTag(code, 'script', 'scriptDataEscaped');
  }

  scriptDataDoubleEscapeStart(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
        case SOLIDUS:
        case GT:
          const name = buffer.getString(1);
          buffer.append(code);
          return name === 'script' ? 'scriptDataDoubleEscaped' : 'scriptDataEscaped';
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            buffer.append(code);
            code = this.nextCode();
          } else {
            return this.scriptDataEscaped(code);
          }
      }
    }
  }

  scriptDataDoubleEscaped(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          return 'scriptDataDoubleEscapedDash';
        case LT:
          this.tagStartMark = buffer.position;
          buffer.append(code);
          return 'scriptDataDoubleEscapedLessThanSign';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
          break;
      }
    }
  }

  scriptDataDoubleEscapedDash(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case HYPHEN:
        buffer.append(code);
        return 'scriptDataDoubleEscapedDashDash';
      case LT:
        this.tagStartMark = buffer.position;
        buffer.append(code);
        return 'scriptDataDoubleEscapedLessThanSign';
      case NUL:
        this.error('unexpected-null-character');
        buffer.append(REPLACEMENT_CHAR);
        return 'scriptDataDoubleEscaped';
      case EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      default:
        buffer.append(code);
        return 'scriptDataDoubleEscaped';
    }
  }

  scriptDataDoubleEscapedDashDash(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          code = this.nextCode();
          break;
        case LT:
          this.tagStartMark = buffer.position;
          buffer.append(code);
          return 'scriptDataDoubleEscapedLessThanSign';
        case GT:
          buffer.append(code);
          return 'scriptData';
        case NUL:
          this.error('unexpected-null-character');
          buffer.append(REPLACEMENT_CHAR);
          return 'scriptDataDoubleEscaped';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        default:
          buffer.append(code);
          return 'scriptDataDoubleEscaped';
      }
    }
  }

  scriptDataDoubleEscapedLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    if (code === SOLIDUS) {
      buffer.append(code);
      return 'scriptDataDoubleEscapeEnd';
    } else {
      return this.scriptDataDoubleEscaped(code);
    }
  }

  scriptDataDoubleEscapeEnd(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
        case SOLIDUS:
        case GT:
          const name = buffer.getString(this.tagStartMark + 2);
          buffer.append(code);
          return name === 'script' ? 'scriptDataEscaped' : 'scriptDataDoubleEscaped';
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            buffer.append(code);
            code = this.nextCode();
          } else {
            return this.scriptDataDoubleEscaped(code);
          }
      }
    }
  }
}