import {CharacterSource} from '../common/stream-source';

export interface CsvDocument {
  header?: string[];
  records: string[][];
}

const LF = 0x0A;
const CR = 0x0D;
const DQUOTE = 0x22;
const COMMA = 0x2C;

const START_ROW = 1;
const READ_ROW = 2;
const START_TOKEN = 3;
const CHECK_TOKEN = 4;
const START_QUOTED = 5;
const READ_QUOTED = 6;
const CHECK_ESCAPE = 7;
const END_QUOTED = 8;
const START_UNQUOTED = 9;
const READ_UNQUOTED = 10;
const END_UNQUOTED = 11;
const END_TOKEN = 12;
const END_ROW = 13;
const START_DOC = 14;
const READ_DOC = 15
const STATE_CR = 16;
const END_DOC = 17;

export class CsvParser {
  private buffer: Uint32Array;

  constructor(bufferSize: number = 1 << 12) {
    this.buffer = new Uint32Array(bufferSize);
  }

  parse(input: CharacterSource, hasHeader = false): CsvDocument {
    return this.csv(input, hasHeader);
  }

  get bufferSize(): number {
    return this.buffer.length;
  }

  set bufferSize(value: number) {
    if (this.buffer.length !== value)
      this.buffer = new Uint32Array(value);
  }

  protected csv(input: CharacterSource, hasHeader: boolean): CsvDocument {
    let state = START_DOC;
    let result: CsvDocument = {
      records: []
    };
    let code: number = input.get();
    while (true) {
      switch (state) {
        case START_DOC:
          if (code === -2) code = input.next();
          if (hasHeader) {
            result.header = this.row(input);
            state = END_ROW;
          } else
            state = READ_DOC;
          break;
        case READ_DOC:
          switch (code = input.get()) {
            case -1:
              state = END_DOC;
              break;
            default:
              result.records.push(this.row(input));
              state = END_ROW;
          }
          break;
        case END_ROW:
          switch (code = input.get()) {
            case -1:
              state = END_DOC;
              break;
            case LF:
              code = input.next();
              state = READ_DOC;
              break;
            case CR:
              state = STATE_CR;
              break;
          }
          break;
        case STATE_CR:
          switch (code = input.next()) {
            case -1:
              state = END_DOC;
              break;
            case LF:
              code = input.next();
            default:
              state = READ_DOC;
              break;
          }
          break;
        case END_DOC:
          return result;
      }
    }
  }

  protected row(input: CharacterSource): string[] {
    let state: number = START_ROW;
    let tokens: string[] = [];
    let code: number = input.get();
    while (true) {
      switch (state) {
        case START_ROW:
          state = READ_ROW;
        case READ_ROW:
          switch (code) {
            case -1:
            case LF:
            case CR:
              state = END_ROW;
              break;
            default:
              state = START_TOKEN;
          }
          break;
        case START_TOKEN:
          tokens.push(this.field(input));
          state = END_TOKEN;
        case END_TOKEN:
          switch (code = input.get()) {
            case COMMA:
              code = input.next();
              state = START_TOKEN;
              break;
            default:
              state = READ_ROW;
          }
          break;
        case END_ROW:
          return tokens;
      }
    }
  }

  protected field(input: CharacterSource): string {
    let state: number = START_TOKEN;
    let code: number = input.get();
    while (true) {
      switch (state) {
        case START_TOKEN:
          state = CHECK_TOKEN;
        case CHECK_TOKEN:
          switch (code) {
            case DQUOTE:
              state = START_QUOTED;
              break;
            case COMMA:
              state = END_TOKEN;
              break;
            case -1:
            case LF:
            case CR:
              throw new Error();
            default:
              state = START_UNQUOTED;
          }
          break;
        case START_QUOTED:
          return this.quoted(input);
        case START_UNQUOTED:
          return this.unquoted(input);
        case END_TOKEN:
          return '';
      }
    }
  }

  protected quoted(input: CharacterSource): string {
    const buffer = this.buffer;
    let state = START_QUOTED;
    let tokenLen = 0;
    let code = input.get();
    while (true) {
      switch (state) {
        case START_QUOTED:
          state = READ_QUOTED;
        case READ_QUOTED:
          switch (code = input.next()) {
            case DQUOTE:
              state = CHECK_ESCAPE;
              break;
            default:
              buffer[tokenLen++] = code;
          }
          break;
        case CHECK_ESCAPE:
          switch (code = input.next()) {
            case DQUOTE:
              buffer[tokenLen++] = DQUOTE;
              state = READ_QUOTED;
              break;
            default:
              state = END_QUOTED;
          }
          break;
        case END_QUOTED:
          code = input.next();
          return String.fromCodePoint(...buffer.subarray(0, tokenLen));
      }
    }
  }

  protected unquoted(input: CharacterSource): string {
    const buffer = this.buffer;
    let state = START_UNQUOTED;
    let tokenLen = 0;
    let code = input.get();
    while (true) {
      switch (state) {
        case START_UNQUOTED:
          buffer[tokenLen++] = code;
          state = READ_UNQUOTED;
        case READ_UNQUOTED:
          switch (code = input.next()) {
            case LF:
            case CR:
            case COMMA:
              state = END_UNQUOTED;
              break;
            default:
              buffer[tokenLen++] = code;
          }
          break;
        case END_UNQUOTED:
          return String.fromCodePoint(...buffer.subarray(0, tokenLen));
      }
    }
  }
}
