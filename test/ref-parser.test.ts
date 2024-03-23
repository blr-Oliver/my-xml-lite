import {HTML_SPECIAL} from '../src/common/known-named-refs';
import {DirectCharacterSource} from '../src/common/stream-source';
import {CharacterReferenceParser} from '../src/decl/CharacterReferenceParser';
import {buildIndex} from '../src/impl/entity-ref-index';
import {FixedSizeStringBuilder} from '../src/impl/FixedSizeStringBuilder';
import {StateBasedRefParser} from '../src/impl/StateBasedRefParser';
import {setChars} from './common';

type TestCase = {
  // input
  input: string;
  isAttribute: boolean;
  // expected output
  output: string;
  inputPosition: number;
  errors?: string[];
}

function createSuite(parser: CharacterReferenceParser) {
  describe('Character reference parser tests', () => {
    let input = new DirectCharacterSource(new Uint16Array(1 << 10));

    function performTest(test: TestCase, name?: string) {
      if (!name)
        name = `${test.isAttribute ? 'IN' : 'NOT IN'} attribute: ${test.input} -> ${test.output} (${test.inputPosition} consumed, ${test.errors?.length || 0} errors)`;
      it(name, () => {
        input.reset();
        setChars(input, test.input);
        parser.parse(input, test.isAttribute);
        let output = String.fromCodePoint(...parser.output.flatMap(chunk => chunk));
        expect(output).toBe(test.output);
        expect(parser.errors).toStrictEqual(test.errors || []);
        expect(parser.reconsume ? input.getPosition() - 1 : input.getPosition()).toBe(test.inputPosition);
      })
    }

    describe('numeric', () => {
      describe('decimal', () => {
        performTest({
          isAttribute: true,
          input: '#97;',
          output: 'a',
          inputPosition: 4
        });
        performTest({
          isAttribute: true,
          input: '#97;xx',
          output: 'a',
          inputPosition: 4
        });
        performTest({
          isAttribute: true,
          input: '#97+',
          output: 'a',
          inputPosition: 3,
          errors: ['missing-semicolon-after-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#97a',
          output: 'a',
          inputPosition: 3,
          errors: ['missing-semicolon-after-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#+',
          output: '&#',
          inputPosition: 1,
          errors: ['absence-of-digits-in-numeric-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#;',
          output: '&#',
          inputPosition: 1,
          errors: ['absence-of-digits-in-numeric-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#a',
          output: '&#',
          inputPosition: 1,
          errors: ['absence-of-digits-in-numeric-character-reference']
        });
      });
      describe('hexadecimal', () => {
        performTest({
          isAttribute: true,
          input: '#x61;',
          output: 'a',
          inputPosition: 5
        });
        performTest({
          isAttribute: true,
          input: '#x61;A',
          output: 'a',
          inputPosition: 5
        });
        performTest({
          isAttribute: true,
          input: '#x61',
          output: 'a',
          inputPosition: 4,
          errors: ['missing-semicolon-after-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x61q',
          output: 'a',
          inputPosition: 4,
          errors: ['missing-semicolon-after-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x6A;',
          output: 'j',
          inputPosition: 5
        });
        performTest({
          isAttribute: true,
          input: '#X6a;',
          output: 'j',
          inputPosition: 5
        });
        performTest({
          isAttribute: true,
          input: '#xabc;',
          output: '\u0abc',
          inputPosition: 6
        });
        performTest({
          isAttribute: true,
          input: '#XABC;',
          output: '\u0abc',
          inputPosition: 6
        });
        performTest({
          isAttribute: true,
          input: '#x',
          output: '&#x',
          inputPosition: 2,
          errors: ['absence-of-digits-in-numeric-character-reference parse error']
        });
        performTest({
          isAttribute: true,
          input: '#X;',
          output: '&#X',
          inputPosition: 2,
          errors: ['absence-of-digits-in-numeric-character-reference parse error']
        });
        performTest({
          isAttribute: true,
          input: '#xx',
          output: '&#x',
          inputPosition: 2,
          errors: ['absence-of-digits-in-numeric-character-reference parse error']
        });
      });
      describe('special', () => {
        performTest({
          isAttribute: true,
          input: '#0;q',
          output: '\uFFFD',
          inputPosition: 3,
          errors: ['null-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x110000q',
          output: '\uFFFD',
          inputPosition: 8,
          errors: ['missing-semicolon-after-character-reference', 'character-reference-outside-unicode-range']
        });
        performTest({
          isAttribute: true,
          input: '#xD801;',
          output: '\uFFFD',
          inputPosition: 7,
          errors: ['surrogate-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x2ffff;',
          output: '\uFFFD',
          inputPosition: 8,
          errors: ['noncharacter-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x0D;',
          output: '\u000D',
          inputPosition: 5,
          errors: ['control-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x01;',
          output: '\u0001',
          inputPosition: 5,
          errors: ['control-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x0A;',
          output: '\u000A',
          inputPosition: 5
        });
        performTest({
          isAttribute: true,
          input: '#x81;',
          output: '\u0081',
          inputPosition: 5,
          errors: ['control-character-reference']
        });
        performTest({
          isAttribute: true,
          input: '#x80;',
          output: '\u20ac',
          inputPosition: 5,
          errors: ['control-character-reference']
        });
      });
    });
    describe('named', () => {
      performTest({
        isAttribute: true,
        input: 'apos;',
        output: '\'',
        inputPosition: 5
      });
      performTest({
        isAttribute: true,
        input: 'lt;',
        output: '<',
        inputPosition: 3
      });
      performTest({
        isAttribute: false,
        input: 'ltt',
        output: '<',
        inputPosition: 2,
        errors: ['missing-semicolon-after-character-reference']
      });
      performTest({
        isAttribute: true,
        input: 'ltt',
        output: '&lt',
        inputPosition: 2
      });
      performTest({
        isAttribute: false,
        input: 'lt=',
        output: '<',
        inputPosition: 2,
        errors: ['missing-semicolon-after-character-reference']
      });
      performTest({
        isAttribute: true,
        input: 'lt=',
        output: '&lt',
        inputPosition: 2
      });
      performTest({
        isAttribute: true,
        input: 'lt-',
        output: '<',
        inputPosition: 2,
        errors: ['missing-semicolon-after-character-reference']
      });
      performTest({
        isAttribute: true,
        input: '9;',
        output: '&9',
        inputPosition: 1,
        errors: ['unknown-named-character-reference']
      });
      performTest({
        isAttribute: true,
        input: '9',
        output: '&9',
        inputPosition: 1
      });
      performTest({
        isAttribute: true,
        input: '9 9',
        output: '&9',
        inputPosition: 1
      });
      performTest({
        isAttribute: true,
        input: '9abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd',
        output: '&abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd',
        inputPosition: 49
      });
    });
  });
}

createSuite(new StateBasedRefParser(buildIndex(HTML_SPECIAL), new FixedSizeStringBuilder(32)));