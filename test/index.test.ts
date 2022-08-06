import {readFileSync} from 'fs';
import {document} from '../src/parser';
import {BufferedStringSource, StringSource, UTF16NonValidatingCharacterSource, UTF8NonValidatingCharacterSource} from '../src/stream-source';
import {stringify} from '../src/stringifier';

function inlineStringSource(s: string): StringSource {
  const data = new Uint16Array(s.length);
  for (let i = 0; i < data.length; ++i)
    data[i] = s.charCodeAt(i)!;
  const charSource = new UTF16NonValidatingCharacterSource(data);
  return new BufferedStringSource(charSource, data.length);
}

function fileStringSource(name: string): StringSource {
  const buffer = readFileSync(name);
  const data = new Uint8Array(buffer);
  const charSource = new UTF8NonValidatingCharacterSource(data);
  return new BufferedStringSource(charSource);
}

function fileBasedTest(inFile: string, outFile: string) {
  const input = fileStringSource(inFile);
  expect(input).toBeDefined();
  const doc = document(input);
  expect(doc).toBeDefined();
  expect(doc.type).toBe('document');
  expect(doc.childNodes).toBeDefined();
  expect(doc.childNodes.length).toBeGreaterThan(0);
  const output = stringify(doc);
  expect(output).toBeDefined();
  expect(output.length).toBeGreaterThan(0);
  const expected: string = readFileSync(outFile, {encoding: 'utf-8'});
  expect(output).toEqual(expected);
}

describe('parse-stringify cycle', function () {
  describe('primitive', function () {
    const primitiveRoot = './test/samples/primitive';
    function primitiveCase(name: string) {
      const fileName = `${primitiveRoot}/${name}.in-out.html`;
      test(name, () => {
        fileBasedTest(fileName, fileName);
      });
    }
    primitiveCase('cdata');
    primitiveCase('comment');
    primitiveCase('pi');
    primitiveCase('element');
    primitiveCase('text');
  })
});

describe('fine-grained', () => {
  /*
  describe('skipToSeq', function () {
    test('at start', () => {
      const hay = 'aabaacaabaac';
      const needle = 'aabaac';
      let parser = new Parser(stringToUArray(hay));
      let seq = inlineStringSource(needle);
      parser.skipToSeq(seq);
      expect(parser.nextPos).toBe(needle.length);
      expect(parser.lastPos).toBe(needle.length - 1);
    });

    test('in middle', () => {
      const hay = 'abaabab';
      const needle = 'aab';
      let parser = new Parser(stringToUArray(hay));
      let seq = inlineStringSource(needle);
      parser.skipToSeq(seq);
      expect(parser.nextPos).toBe(5);
      expect(parser.lastPos).toBe(4);
    });

    test('at end', () => {
      const hay = 'aabaababaaabaac';
      const needle = 'aabaac';
      let parser = new Parser(stringToUArray(hay));
      let seq = inlineStringSource(needle);
      parser.skipToSeq(seq);
      expect(parser.nextPos).toBe(hay.length);
      expect(parser.lastPos).toBe(hay.length - 1);
    });

    test('missing', () => {
      const hay = 'aabaabaabaab';
      const needle = 'abb';
      let parser = new Parser(stringToUArray(hay));
      let seq = inlineStringSource(needle);
      parser.skipToSeq(seq);
      expect(parser.nextPos).toBe(hay.length);
      expect(parser.lastPos).toBe(hay.length);
      expect(parser.lastCode).toBe(-1);
    });
  });
  */

  /*
  describe('readText', function () {
    test('empty', () => {
      let parser = new Parser(stringToUArray(''));
      let text = parser.readText();
      expect(parser.nextPos).toBe(0);
      expect(parser.lastCode).toBe(-1);
      expect(text).toBe('');
    })

    test('text till end', () => {
      let parser = new Parser(stringToUArray('ABC'));
      let text = parser.readText();
      expect(parser.nextPos).toBe(3);
      expect(parser.lastCode).toBe(-1);
      expect(text).toBe('ABC');
    })

    test('immediate LT', () => {
      let parser = new Parser(stringToUArray('<'));
      let text = parser.readText();
      expect(parser.nextPos).toBe(1);
      expect(parser.lastCode).toBe(60);
      expect(text).toBe('');
    });

    test('text with LT', () => {
      let s = 'ABC <';
      let parser = new Parser(stringToUArray(s));
      let text = parser.readText();
      expect(parser.nextPos).toBe(s.length);
      expect(parser.lastCode).toBe(60);
      expect(text).toBe('ABC ');
    });

  });
  */
  /*
  describe('consumeNext', function () {
    describe('negatives', function () {
      test('trailing first', () => {
        let data = new Uint16Array([0xDC00, 0xD820]);
        let parser = new Parser(data);
        expect(() => parser.consumeNext()).toThrow();
      });

      test('end of input', () => {
        let data = new Uint16Array([0xD801]);
        let parser = new Parser(data);
        expect(() => parser.consumeNext()).toThrow();
      });

      test('trailing is not a surrogate', () => {
        let data = new Uint16Array([0xD800, 0x0020]);
        let parser = new Parser(data);
        expect(() => parser.consumeNext()).toThrow();
      });

      test('trailing is leading', () => {
        let data = new Uint16Array([0xD800, 0xD820]);
        let parser = new Parser(data);
        expect(() => parser.consumeNext()).toThrow();
      });
    });

    describe('positives', function () {
      test('end of input', () => {
        let data = new Uint16Array([]);
        let parser = new Parser(data);
        let code = parser.consumeNext();
        expect(code).toBe(-1);
        expect(parser.nextPos).toBe(0);
        expect(parser.lastCode).toBe(code);
      });

      test('standard plane', () => {
        let data = new Uint16Array([0x0041]);
        let parser = new Parser(data);
        let code = parser.consumeNext();
        expect(String.fromCodePoint(code)).toBe('A');
        expect(parser.nextPos).toBe(1);
        expect(parser.lastCode).toBe(code);
      });

      test('extra plane 1', () => {
        let data = new Uint16Array([0xD801, 0xDC37]);
        let parser = new Parser(data);
        let code = parser.consumeNext();
        expect(code).toBe(0x10437);
        expect(parser.nextPos).toBe(2);
        expect(parser.lastCode).toBe(code);
      });
      test('extra plane 2', () => {
        let data = new Uint16Array([0xD901, 0xDD01]);
        let parser = new Parser(data);
        let code = parser.consumeNext();
        expect(code).toBe(0x50501);
        expect(parser.nextPos).toBe(2);
        expect(parser.lastCode).toBe(code);
      });

    });
  });
  */
});
