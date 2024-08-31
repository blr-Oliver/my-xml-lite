import {Readable} from 'stream';
import {CharacterSource} from '../../interfaces/CharacterSource.js';
import {CodePoints} from '../../interfaces/CodePoints.js';
import {Document} from '../../interfaces/dom-types.js';
import {HTML_SPECIAL} from '../../interfaces/named-character-refs.js';
import {Resettable} from '../../interfaces/Resettable.js';
import {HtmlLiteParser} from '../HtmlLiteParser.js';
import {SimpleNodeFactory} from '../simple-tree/SimpleNodeFactory.js';
import {buildIndex} from '../util/build-index.js';

export interface ArrayData {
  [index: number]: number;
}

export class ChunkedCharacterSource<T extends ArrayData> implements CharacterSource, Resettable {
  bottom: number;
  active!: number;
  top: number;
  position!: number;
  chunks: T[];
  current!: T;

  constructor() {
    this.chunks = [];
    this.bottom = this.top = 0;
  }

  addChunk(chunk: T): void {
    this.chunks[this.top++] = chunk;
  }

  canAdvance(): boolean {
    return this.active < this.top;
  }

  advance(): void {
    this.active = (this.active + 1) || 0;
    this.position = 0;
    this.current = this.chunks[this.active];
  }

  takeChunk(): T | undefined {
    if (this.bottom < this.active)
      return this.chunks[this.bottom++];
  }

  next(): number {
    return this.current[this.position++];
  }

  reset() {
    this.position = this.bottom = this.top = 0;
    this.active = undefined as unknown as number;
    this.current = undefined as unknown as T;
  }
}

export function parseFromStream(stream: Readable, callback: (document: Document) => void): void {
  const input = new ChunkedCharacterSource();
  const parser = new HtmlLiteParser(input, new SimpleNodeFactory(), buildIndex(HTML_SPECIAL));

  function consumeChunks(maxCount: number = -1) {
    for (let i = 0; i !== maxCount && parser.active && parser.paused; ++i) {
      if (input.canAdvance()) {
        input.advance();
        parser.proceed();
      } else break;
    }
  }

  stream.on('end', () => {
    input.addChunk([CodePoints.EOF]);
    consumeChunks();
    callback(parser.document);
  });

  stream.once('readable', () => {
    const firstChunk: Buffer = stream.read();
    input.addChunk([...new Uint8Array(firstChunk), CodePoints.EOC]);
    input.advance();
    stream.on('data', (chunk: Buffer | null) => {
      if (chunk) input.addChunk([...new Uint8Array(chunk), CodePoints.EOC]);
      consumeChunks(1);
    });
    parser.proceed();
  });
}