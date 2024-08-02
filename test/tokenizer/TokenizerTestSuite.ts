import {stringToArray} from '../../src/common/code-sequences.js';
import {DirectCharacterSource} from '../../src/common/stream-source.js';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder.js';
import {ErrorTracker} from '../../src/impl/interfaces/error-tracker.js';
import {ParserEnvironment} from '../../src/impl/interfaces/ParserEnvironment.js';
import {State} from '../../src/impl/interfaces/states.js';
import {Token} from '../../src/impl/interfaces/tokens.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';

export abstract class TokenizerTestSuite<T/*test case*/> implements ErrorTracker {
  name!: string;
  parser!: Tokenizer;
  tokenList: Token[] = [];
  errorList: string[] = [];
  lastState!: State;

  constructor(name: string) {
    this.name = name;
  }

  defineTokenizerClass(): typeof Tokenizer {
    const suite = this;
    return class extends Tokenizer {
      eof(): State {
        suite.lastState = this.state;
        return super.eof();
      }
    };
  }

  createTokenizer(): Tokenizer {
    return new (this.defineTokenizerClass())(buildIndex(HTML_SPECIAL), this);
  }

  error(name: string): void {
    this.errorList.push(name);
  }

  beforeTest() {
    this.parser.state = 'data';
    this.parser.active = true;
    this.parser.env.buffer.clear();
    this.tokenList.length = 0;
    this.errorList.length = 0;
  }

  protected abstract getRegularTestCases(): T[];
  protected abstract runRegularTest(test: T): void;
  protected getTestName(test: T): string {
    return (test as any[])[0] as string;
  }
  protected makeCustomTests() {
  }

  processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    this.parser.input = newInput;
    this.parser.proceed();
  }

  makeSuite() {
    beforeAll(() => {
      const tokenList = this.tokenList;
      const parser = this.parser = this.createTokenizer();
      parser.env = {
        buffer: new FixedSizeStringBuilder(1000),
        tokens: {
          accept(token: Token) {
            tokenList.push(token);
          }
        }
      } as any as ParserEnvironment;
      parser.tokenQueue = [];
    });

    beforeEach(() => {
      this.beforeTest();
    });

    describe(this.name, () => {
      describe('regular tests', () => {
        let tests = this.getRegularTestCases();
        for (let test of tests)
          it(this.getTestName(test), () => this.runRegularTest(test));
      });
      describe('special tests', () => this.makeCustomTests());
    });
  }
}