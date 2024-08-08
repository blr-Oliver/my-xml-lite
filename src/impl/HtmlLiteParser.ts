import {CharacterSource} from '../interfaces/CharacterSource.js';
import {Document} from '../interfaces/dom-types.js';
import {ErrorHandler, ignoring} from '../interfaces/ErrorHandler.js';
import {NodeFactory} from '../interfaces/NodeFactory.js';
import {Parser} from '../interfaces/Parser.js';
import {PrefixNode} from '../interfaces/PrefixNode.js';
import {Tokenizer} from './Tokenizer.js';
import {TreeComposer} from './TreeComposer.js';

export class HtmlLiteParser implements Parser {
  readonly tokenizer: Tokenizer;
  readonly composer: TreeComposer;

  constructor(input: CharacterSource, factory: NodeFactory, characterReferenceIndex: PrefixNode<number[]>, errorHandler: ErrorHandler = ignoring) {
    this.tokenizer = new Tokenizer(characterReferenceIndex, errorHandler);
    this.composer = new TreeComposer(factory, errorHandler);
    this.tokenizer.composer = this.composer;
    this.composer.tokenizer = this.tokenizer;
    this.reset(input);
  }

  get active(): boolean {
    return this.tokenizer.active;
  }

  get paused(): boolean {
    return this.tokenizer.paused;
  }

  get document(): Document {
    return this.composer.document;
  }

  proceed(): boolean {
    this.tokenizer.proceed();
    return this.tokenizer.paused && this.tokenizer.active;
  }

  reset(input?: CharacterSource): void {
    if (input) this.tokenizer.input = input;
    this.tokenizer.reset();
    this.composer.reset();
  }
}