export interface CharacterSource {
  /**
   * @return next valid Unicode code point (including characters outside BMP) or -1 if the source is exhausted
   */
  next(): number | -1;
  /**
   * @return current (last returned) valid Unicode code point (including characters outside BMP) or -1 if the source is exhausted or -2 if no code point was drained yet
   */
  get(): number | -1 | -2;
}

export interface RestartableCharacterSource extends CharacterSource {
  restart(): void;
}

export interface StringSource extends CharacterSource {
  /**
   Marks start of a new string, including last read character.

   @return last read character
   */
  start(): number;
  /**
   Constructs a string from previously marked position to current position, not including last read character
   */
  end(cutStart?: number, cutEnd?: number): string;
}

export class BufferedStringSource implements StringSource {
  private readonly buffer: Uint32Array;
  private position: number = -1;

  constructor(private readonly source: CharacterSource,
              bufferSize: number = 1 << 14 /* 16K */) {
    this.buffer = new Uint32Array(bufferSize);
  }

  next(): number {
    return this.buffer[++this.position] = this.source.next();
  }

  get(): number {
    return this.source.get();
  }

  start(): number {
    return this.buffer[this.position = 0] = this.get();
  }

  end(cutStart: number = 0, cutEnd: number = 0): string {
    return String.fromCodePoint(...this.buffer.slice(cutStart, this.position - cutEnd));
  }
}

export abstract class ArrayCharacterSource<T extends ArrayLike<number>> implements RestartableCharacterSource {
  protected position: number;
  protected code: number = -2;

  protected constructor(protected readonly data: T,
                        protected readonly limit: number = data.length,
                        protected readonly offset: number = 0) {
    this.position = offset;
  }

  restart() {
    this.position = this.offset;
    this.code = -2;
  }

  protected abstract consumeNext(): number;

  next(): number {
    if (this.position >= this.limit) return this.code = -1;
    return this.code = this.consumeNext();
  }

  get(): number {
    return this.code;
  }
}

export class UTF16NonValidatingCharacterSource extends ArrayCharacterSource<Uint16Array> {
  constructor(data: Uint16Array, limit?: number, offset?: number) {
    super(data, limit, offset);
  }

  consumeNext(): number {
    const word1 = this.data[this.position++];
    if (word1 < 0xD800 || word1 >= 0xE000) return word1;
    const word2 = this.data[this.position++];
    return (0x10000 + (((word1 & 0x3FF) << 10) | (word2 & 0x3FF)));
  }
}

export class UTF8NonValidatingCharacterSource extends ArrayCharacterSource<Uint8Array> {
  constructor(data: Uint8Array, limit?: number, offset?: number) {
    super(data, limit, offset);
  }

  consumeNext(): number {
    const byte1 = this.data[this.position++];
    const leadingOnes = Math.clz32(~byte1 & 0xFF) - 24;
    if (leadingOnes === 0) return byte1;
    return this.withTails(byte1, leadingOnes - 1);
  }

  private withTails(byte1: number, count: number): number {
    let value = byte1 & (0x7F >> count);
    for (let i = 0; i < count; ++i)
      value = (value << 6) | (this.data[this.position++] & 0x3F);
    return value;
  }
}