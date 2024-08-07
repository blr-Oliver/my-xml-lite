import {Readable} from 'stream';
import {ReadableStream} from 'stream/web';
import {ErrorHandler} from '../impl/interfaces/error-tracker.js';
import {NodeFactory} from '../impl/interfaces/NodeFactory.js';
import {Document} from './dom-like.js';
import {PrefixNode} from './entity-ref-index.js';
import {Parser} from './Parser.js';

export interface ParserOptions {
  nodeFactory: NodeFactory;
  characterReferenceIndex: PrefixNode<number[]>;
  errorHandler: ErrorHandler;
}

export interface ParserFactory {
  readonly nodeFactory: NodeFactory;
  readonly characterReferenceIndex: PrefixNode<number[]>;
  readonly errorHandler: ErrorHandler;

  configure(options: Partial<ParserOptions>): void;
  createParser(options?: Partial<ParserOptions>): Parser;
  parseString(html: string, options?: Partial<ParserOptions>): Document;

  parseNodeStream(stream: Readable, callback: (document: Document) => void, options?: Partial<ParserOptions>): void;
  parseNodeStreamAsync(stream: Readable, options?: Partial<ParserOptions>): Promise<Document>;

  parseWebStream(stream: ReadableStream<Uint8Array>, callback: (document: Document) => void, options?: Partial<ParserOptions>): void;
  parseWebStreamAsync(stream: ReadableStream<Uint8Array>, options?: Partial<ParserOptions>): Promise<Document>;
}
