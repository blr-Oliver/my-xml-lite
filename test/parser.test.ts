import {readFileSync} from 'fs';
import {BufferedStringSource, StringSource, UTF16NonValidatingCharacterSource, UTF8NonValidatingCharacterSource} from '../src';
import {document, skipToSeq} from '../src/parser';
import {stringify} from '../src/stringifier';

function fileStringSource(name: string): StringSource {
  const buffer = readFileSync(name);
  const data = new Uint8Array(buffer);
  const charSource = new UTF8NonValidatingCharacterSource(data);
  return new BufferedStringSource(charSource);
}

function stringToUTF16Array(s: string): Uint16Array {
  return new Uint16Array(Array.from(Array(s.length), (_, i) => s.charCodeAt(i)));
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
  const samplesRoot = './test/samples/';
  function standardCase(name: string) {
    test(name, () => {
      fileBasedTest(`${samplesRoot}${name}.in.xml`, `${samplesRoot}${name}.out.xml`);
    });
  }

  describe('primitive', function () {
    const primitiveRoot = samplesRoot + 'primitive/';
    function primitiveCase(name: string) {
      const fileName = `${primitiveRoot}${name}.in-out.xml`;
      test(name, () => {
        fileBasedTest(fileName, fileName);
      });
    }
    primitiveCase('cdata');
    primitiveCase('comment');
    primitiveCase('pi');
    primitiveCase('element');
    primitiveCase('text');
    primitiveCase('properly-closed');
    primitiveCase('decl');
  });

  describe('throwing', () => {
    const invalidRoot = samplesRoot + 'invalid/';
    function invalidCase(name: string) {
      test(name, () => {
        const input = fileStringSource(`${invalidRoot}${name}.xml`);
        expect(input).toBeDefined();
        expect(() => document(input)).toThrow();
      });
    }

    invalidCase('broken-cdata-1');
    invalidCase('broken-cdata-2');
    invalidCase('broken-comment-1');
    invalidCase('broken-comment-2');
    invalidCase('broken-tag-1');
    invalidCase('broken-tag-2');
    invalidCase('illegal-name-start-1');
    invalidCase('illegal-name-start-2');
    invalidCase('unfinished-cdata');
    invalidCase('unfinished-comment');
  });
  standardCase('space');
  standardCase('improperly-closed');
  standardCase('entity-enclosed-attribute');
});


describe('skipToSeq', function () {
  function doTest(hay: string, needle: string, expectedPosition: number, expectedCode?: number) {
    const charSource = new UTF16NonValidatingCharacterSource(stringToUTF16Array(hay));
    const seq = stringToUTF16Array(needle);
    const source = new BufferedStringSource(charSource, hay.length);
    const skipResult = skipToSeq(source, (seq as any) as number[]);
    expect((source as any).position).toBe(expectedPosition);
    if (expectedCode !== undefined)
      expect(skipResult).toBe(expectedCode);
  }
  function testCase(name: string, hay: string, needle: string, pos: number, code?: number) {
    test(name, () => doTest(hay, needle, pos, code));
  }

  const hay1 = 'aabaacaabaac', needle1 = 'aabaac';
  testCase('at start', hay1, needle1, needle1.length - 1);

  const hay2 = 'abaabab', needle2 = 'aab';
  testCase('in middle', hay2, needle2, 4);

  const hay3 = 'aabaababaaabaac', needle3 = 'aabaac';
  testCase('at end', hay3, needle3, hay3.length - 1);

  const hay4 = 'aabaabaabaab', needle4 = 'abb';
  testCase('missing', hay4, needle4, hay4.length, -1);
});
