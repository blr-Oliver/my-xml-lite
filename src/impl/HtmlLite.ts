import {Readable} from 'stream';
import {ReadableStream} from 'stream/web';
import {Document} from '../decl/dom-like.js';
import {PrefixNode} from '../decl/entity-ref-index.js';
import {HTML_SPECIAL} from '../decl/known-named-refs.js';
import {Parser} from '../decl/Parser.js';
import {ParserFactory, ParserOptions} from '../decl/ParserFactory.js';
import {buildIndex} from './build-index.js';
import {HtmlLiteParser} from './HtmlLiteParser.js';
import {EMPTY_SOURCE} from './input/EmptyCharacterSource.js';
import {StringCharacterSource} from './input/StringCharacterSource.js';
import {ErrorHandler, ignoring} from './interfaces/error-tracker.js';
import {NodeFactory} from './interfaces/NodeFactory.js';
import {SimpleNodeFactory} from './simple-tree/SimpleNodeFactory.js';

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