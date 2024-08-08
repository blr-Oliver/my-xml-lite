import {Readable} from 'stream';
import {ReadableStream} from 'stream/web';
import {Document} from '../interfaces/dom-types.js';
import {ErrorHandler, ignoring} from '../interfaces/ErrorHandler.js';
import {HTML_SPECIAL} from '../interfaces/named-character-refs.js';
import {NodeFactory} from '../interfaces/NodeFactory.js';
import {Parser} from '../interfaces/Parser.js';
import {ParserFactory, ParserOptions} from '../interfaces/ParserFactory.js';
import {PrefixNode} from '../interfaces/PrefixNode.js';
import {HtmlLiteParser} from './HtmlLiteParser.js';
import {EMPTY_SOURCE} from './input/EmptyCharacterSource.js';
import {StringCharacterSource} from './input/StringCharacterSource.js';
import {SimpleNodeFactory} from './simple-tree/SimpleNodeFactory.js';
import {buildIndex} from './util/build-index.js';

export class HtmlLite implements ParserFactory {
  nodeFactory: NodeFactory;
  characterReferenceIndex: PrefixNode<number[]>;
  errorHandler: ErrorHandler;

  constructor(options?: Partial<ParserOptions>) {
    this.nodeFactory = options?.nodeFactory || new SimpleNodeFactory();
    this.characterReferenceIndex = options?.characterReferenceIndex || buildIndex(HTML_SPECIAL);
    this.errorHandler = options?.errorHandler || ignoring;
  };

  configure(options: Partial<ParserOptions>): void {
    this.nodeFactory = options.nodeFactory || this.nodeFactory;
    this.characterReferenceIndex = options.characterReferenceIndex || this.characterReferenceIndex;
    this.errorHandler = options.errorHandler || this.errorHandler;
  }

  createParser(options?: Partial<ParserOptions>): Parser {
    return new HtmlLiteParser(EMPTY_SOURCE,
        options?.nodeFactory || this.nodeFactory,
        options?.characterReferenceIndex || this.characterReferenceIndex,
        options?.errorHandler || this.errorHandler);
  }

  parseString(html: string, options?: Partial<ParserOptions>): Document {
    const source = new StringCharacterSource(html);
    const parser = new HtmlLiteParser(source,
        options?.nodeFactory || this.nodeFactory,
        options?.characterReferenceIndex || this.characterReferenceIndex,
        options?.errorHandler || this.errorHandler);
    while (parser.proceed()) {
    }
    return parser.document;
  }

  parseNodeStream(stream: Readable, callback: (document: Document) => void, options?: Partial<ParserOptions>): void {
    throw new Error('Not implemented');
  }
  parseNodeStreamAsync(stream: Readable, options?: Partial<ParserOptions>): Promise<Document> {
    throw new Error('Not implemented');
  }

  parseWebStream(stream: ReadableStream<Uint8Array>, callback: (document: Document) => void, options?: Partial<ParserOptions>): void {
    throw new Error('Not implemented');
  }
  parseWebStreamAsync(stream: ReadableStream<Uint8Array>, options?: Partial<ParserOptions>): Promise<Document> {
    throw new Error('Not implemented');
  }
}