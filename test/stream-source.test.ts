import {ReconsumableCharacterSource, UTF16ValidatingCharacterSource} from '../src/common/stream-source';

function inlineUTF16Source(data: number[]): ReconsumableCharacterSource {
  return new UTF16ValidatingCharacterSource(new Uint16Array(data));
}

describe('consumeNext', function () {
  describe('negatives', function () {
    function negativeTest(name: string, data: number[]) {
      test(name, () => {
        const source = inlineUTF16Source(data);
        expect(() => source.next()).toThrow();
      });
    }

    negativeTest('trailing first', [0xDC00, 0xD820]);
    negativeTest('end of input', [0xD801]);
    negativeTest('trailing is not a surrogate', [0xD800, 0x0020]);
    negativeTest('trailing is leading', [0xD800, 0xD820]);
  });

  describe('positives', function () {
    function positiveTest(name: string, data: number[], code: number, position: number) {
      test(name, () => {
        const source = inlineUTF16Source(data);
        const next = source.next();
        expect(next).toBe(code);
        expect((source as any).position).toBe(position);
      });
    }

    positiveTest('end of input', [], -1, 0);
    positiveTest('standard plane', [0x0041], 'A'.charCodeAt(0), 1);
    positiveTest('extra plane 1', [0xD801, 0xDC37], 0x10437, 2);
    positiveTest('extra plane 2', [0xD901, 0xDD01], 0x50501, 2);
  });
});
