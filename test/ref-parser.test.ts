import {stringToArray} from '../src/common/code-points';
import {DirectCharacterSource} from '../src/common/stream-source';
import {CharacterReferenceParser} from '../src/decl/CharacterReferenceParser';
import {HTML_SPECIAL} from '../src/decl/known-named-refs';
import {ParserEnvironment} from '../src/decl/ParserEnvironment';
import {StringBuilder} from '../src/decl/StringBuilder';
import {ChainingStringBuilder} from '../src/impl/ChainingStringBuilder';
import {buildIndex} from '../src/impl/character-reference/entity-ref-index';
import {StateBasedRefParser} from '../src/impl/character-reference/StateBasedRefParser';
import {FixedSizeStringBuilder} from '../src/impl/FixedSizeStringBuilder';
import {setChars} from './common';

function createSuite(parser: CharacterReferenceParser) {
  describe('Character reference parser tests', () => {
    let source = new DirectCharacterSource(new Uint16Array(1 << 10));
    let buffer = new FixedSizeStringBuilder(1 << 8);
    let producedErrors: string[] = [];

    function makeTest(input: string, output: string, position: number, errors: string[] = [], reconsume?: boolean, attribute?: boolean, sb: StringBuilder = buffer, initialReconsume = false, extraChecks?: () => void) {
      const commonName = `${input} -> ${output} (${position} consumed, ${errors?.length || 0} errors)`;
      if (attribute === undefined) {
        describe(commonName, () => {
          makeTest(input, output, position, errors, reconsume, true, sb, initialReconsume, extraChecks);
          makeTest(input, output, position, errors, reconsume, false, sb, initialReconsume, extraChecks);
        })
      } else {
        const name = `${attribute ? 'IN' : 'NOT IN'} attribute: ${commonName}`;
        it(name, () => {
          source.reset();
          setChars(source, input);
          if (initialReconsume) source.next();
          sb.clear();
          producedErrors.length = 0;
          const io: ParserEnvironment = {
            input: source,
            buffer: sb,
            errors: producedErrors,
            reconsume: initialReconsume
          }
          parser.parse(io, attribute);
          let actual = sb.getString();
          expect(actual).toBe(output);
          expect(producedErrors).toStrictEqual(errors || []);
          if (reconsume !== undefined) {
            expect(io.reconsume).toBe(reconsume);
            expect(source.getPosition()).toBe(position);
          } else {
            expect(io.reconsume ? source.getPosition() - 1 : source.getPosition()).toBe(position);
          }
          if(extraChecks) extraChecks();
        });
      }
    }

    describe('inter-connection', () => {
      buffer.clear();
      buffer.appendSequence(stringToArray('test'));
      let overlay = new ChainingStringBuilder(buffer);
      let extraCheck = () => {
        expect(buffer.getString()).toBe('testa');
      }
      makeTest('#97;', 'a', 4, [], undefined, true, overlay, true, extraCheck);
      makeTest('#97;', 'a', 4, [], undefined, true, overlay, false, extraCheck);
    });

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

createSuite(new StateBasedRefParser(buildIndex(HTML_SPECIAL)));