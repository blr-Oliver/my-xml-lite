const size = 1000000;

const A = 'A'.charCodeAt(0);
const Z = 'Z'.charCodeAt(0);

function randomArray(size: number): Uint16Array {
  const result = new Uint16Array(size);
  const multiplier = (Z - A) + 1;
  for (let i = 0; i < size; ++i) {
    result[i] = Math.floor(Math.random() * multiplier) + A;
  }
  return result;
}

function dataToString(data: Uint16Array): string {
  const chunkSize = 1 << 16;
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += chunkSize)
    chunks.push(String.fromCharCode(...data.slice(i, i + chunkSize)));
  return chunks.join('');
}

function iterateStringCodePoint(s: string) {
  const result: { [key: string]: number } = {};
  for (let c of s) {
    result[c] = (result[c] || 0) + 1;
  }
  return result;
}

function iterateStringCharCode(s: string) {
  const result: { [key: string]: number } = {};
  for (let c of s.split('')) {
    result[c] = (result[c] || 0) + 1;
  }
  return result;
}

function loopStringChar(s: string) {
  const result: { [key: string]: number } = {};
  const len = s.length;
  let c;
  for (let i = 0; i < len; ++i) {
    c = s.charAt(i);
    result[c] = (result[c] || 0) + 1;
  }
  return result;
}

function loopStringCode(s: string) {
  const codes: number[] = Array(Z);
  const len = s.length;
  let c;
  for (let i = 0; i < len; ++i) {
    c = s.charCodeAt(i);
    codes[c] = (codes[c] || 0) + 1;
  }
  return codes;
}

function loopArray(data: Uint16Array) {
  const codes: number[] = Array(Z);
  const len = data.length;
  let c;
  for (let i = 0; i < len; ++i) {
    c = data[i];
    codes[c] = (codes[c] || 0) + 1;
  }
  return codes;
}

function measure(callback: Function, iterations: number): number {
  const now = Date.now();
  for (let i = 0; i < iterations; ++i)
    callback();
  return (Date.now() - now) / iterations;
}

const data = randomArray(size);
const s = dataToString(data);

const benchmark = {
  iterateStringCodePoint: measure(iterateStringCodePoint.bind(global, s), 100),
  iterateStringCharCode: measure(iterateStringCharCode.bind(global, s), 100),
  loopStringChar: measure(loopStringChar.bind(global, s), 100),
  loopStringCode: measure(loopStringCode.bind(global, s), 100),
  loopArray: measure(loopArray.bind(global, data), 100)
}

console.log(benchmark);
