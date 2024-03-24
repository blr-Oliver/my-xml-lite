import {HTML_SPECIAL} from '../src/common/known-named-refs';
import {DirectCharacterSource} from '../src/common/stream-source';
import {CharacterReferenceParser} from '../src/decl/CharacterReferenceParser';
import {buildIndex} from '../src/impl/entity-ref-index';
import {FixedSizeStringBuilder} from '../src/impl/FixedSizeStringBuilder';
import {StateBasedRefParser} from '../src/impl/StateBasedRefParser';
import {setChars} from './common';

function createSuite(parser: CharacterReferenceParser) {
  describe('Character reference parser tests', () => {
    let source = new DirectCharacterSource(new Uint16Array(1 << 10));

    function makeTest(input: string, output: string, position: number, errors: string[] = [], reconsume?: boolean, attribute?: boolean) {
      const commonName = `${input} -> ${output} (${position} consumed, ${errors?.length || 0} errors)`;
      if (attribute === undefined) {
        describe(commonName, () => {
          makeTest(input, output, position, errors, reconsume, true);
          makeTest(input, output, position, errors, reconsume, false);
        })
      } else {
        const name = `${attribute ? 'IN' : 'NOT IN'} attribute: ${commonName}`;
        it(name, () => {
          source.reset();
          setChars(source, input);
          parser.parse(source, attribute);
          let actual = String.fromCodePoint(...parser.output.flatMap(chunk => chunk));
          expect(actual).toBe(output);
          expect(parser.errors).toStrictEqual(errors || []);
          if (reconsume !== undefined) {
            expect(parser.reconsume).toBe(reconsume);
            expect(source.getPosition()).toBe(position);
          } else {
            expect(parser.reconsume ? source.getPosition() - 1 : source.getPosition()).toBe(position);
          }
        });
      }
    }

    describe('numeric', () => {
      describe('decimal', () => {
        makeTest('#97;', 'a', 4);
        makeTest('#97;xx', 'a', 4);
        makeTest('#97', 'a', 3, ['missing-semicolon-after-character-reference'], true);
        makeTest('#97a', 'a', 3, ['missing-semicolon-after-character-reference']);
        makeTest('#', '&#', 1, ['absence-of-digits-in-numeric-character-reference'], true);
        makeTest('#;', '&#', 1, ['absence-of-digits-in-numeric-character-reference']);
        makeTest('#a', '&#', 1, ['absence-of-digits-in-numeric-character-reference']);
      });
      describe('hexadecimal', () => {
        makeTest('#x61;', 'a', 5);
        makeTest('#x61;A', 'a', 5);
        makeTest('#x61', 'a', 4, ['missing-semicolon-after-character-reference'], true);
        makeTest('#x61q', 'a', 4, ['missing-semicolon-after-character-reference']);
        makeTest('#x6A;', 'j', 5);
        makeTest('#X6a;', 'j', 5);
        makeTest('#xabc;', '\u0abc', 6);
        makeTest('#XABC;', '\u0abc', 6);
        makeTest('#x', '&#x', 2, ['absence-of-digits-in-numeric-character-reference'], true);
        makeTest('#X;', '&#X', 2, ['absence-of-digits-in-numeric-character-reference']);
        makeTest('#xx', '&#x', 2, ['absence-of-digits-in-numeric-character-reference']);
      });
      describe('special', () => {
        makeTest('#0;q', '\uFFFD', 3, ['null-character-reference']);
        makeTest('#x110000q', '\uFFFD', 8, ['missing-semicolon-after-character-reference', 'character-reference-outside-unicode-range']);
        makeTest('#xD801;', '\uFFFD', 7, ['surrogate-character-reference']);
        makeTest('#x2ffff;', '\uD87F\uDFFF', 8, ['noncharacter-character-reference']);
        makeTest('#x0D;', '\u000D', 5, ['control-character-reference']);
        makeTest('#x01;', '\u0001', 5, ['control-character-reference']);
        makeTest('#x0A;', '\u000A', 5);
        makeTest('#x81;', '\u0081', 5, ['control-character-reference']);
        makeTest('#x80;', '\u20ac', 5, ['control-character-reference']);
      });
    });
    describe('named', () => {
      makeTest('apos;', '\'', 5, [], true);
      makeTest('lt;', '<', 3, [], true);
      makeTest('ltt', '<', 2, ['missing-semicolon-after-character-reference'], undefined, false);
      makeTest('ltt', '&lt', 2, [], undefined, true);
      makeTest('lt=', '<', 2, ['missing-semicolon-after-character-reference'], undefined, false);
      makeTest('lt=', '&lt', 2, [], undefined, true);
      makeTest('lt-', '<', 2, ['missing-semicolon-after-character-reference']);
      makeTest('9;', '&9', 1, ['unknown-named-character-reference']);
      makeTest('9', '&9', 1, [], true);
      makeTest('9 9', '&9', 1);
      makeTest('9abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd', '&9abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd', 49, [], true);
      makeTest('9abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd+', '&9abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd', 49);
    });
  });
}

createSuite(new StateBasedRefParser(buildIndex(HTML_SPECIAL), new FixedSizeStringBuilder(32)));