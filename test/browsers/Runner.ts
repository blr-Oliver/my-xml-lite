import {SelfClosingOptions, Serializer} from '../../src/impl/Serializer.js';
import {Document} from '../../src/interfaces/dom-types.js';
import {DefaultRawTestCore} from '../composer/abstract-suite.js';

interface DOMParser {
  parseFromString(string: string, type: 'text/html'): Document;
}

declare var DOMParser: {
  prototype: DOMParser;
  new(): DOMParser;
};

declare function fetch(input: string): Promise<{ json(): Promise<any> }>;

type ParsedCase = [string, string, string];
type SampleCollection = { [suite: string]: DefaultRawTestCore[] };

const sampleRoot = 'test/composer/samples';
const sampleNames = [
  'after-after-body',
  'after-after-frameset',
  'after-body',
  'after-frameset',
  'after-head',
  'before-head',
  'before-html',
  'foreign-attributes',
  'formatting',
  'in-body',
  'in-caption',
  'in-cell',
  'in-column-group',
  'in-foreign-content',
  'in-frameset',
  'in-head-noscript',
  'in-head',
  'in-row',
  'in-select-in-table',
  'in-select',
  'in-table-body',
  'in-table',
  'in-template'
];

async function loadSampleFile(name: string): Promise<DefaultRawTestCore[]> {
  return fetch(`${sampleRoot}/${name}.json`)
      .then(response => response.json());
}

async function loadAllSamples(sampleNames: string[]): Promise<SampleCollection> {
  const data = await Promise.all(sampleNames.map(name => loadSampleFile(name)));
  const result: SampleCollection = {};
  for (let i = 0; i < sampleNames.length; ++i) {
    result[sampleNames[i]] = data[i];
  }
  return result;
}

export class Runner {
  parser: DOMParser;
  samples: SampleCollection;
  nativeData!: { [suite: string]: ParsedCase[] };
  liteData!: { [suite: string]: ParsedCase[] };
  serializer: Serializer;

  constructor(samples: SampleCollection) {
    this.parser = new DOMParser();
    this.samples = samples;
    this.serializer = new Serializer({
      htmlVoidSelfClose: SelfClosingOptions.SKIP,
      foreignVoidSelfClose: SelfClosingOptions.SKIP
    });
  }

  run() {
    const nativeData: { [suite: string]: ParsedCase[] } = {};
    const liteData: { [suite: string]: ParsedCase[] } = {};
    for (let suiteName in this.samples) {
      const suite = this.samples[suiteName];
      const nativeParsed: ParsedCase[] = [];
      const liteParsed: ParsedCase[] = []
      for (let testCase of suite) {
        const name = testCase[0];
        const input = testCase[1];
        const document = this.parser.parseFromString(input, 'text/html');
        const nativeOutput = (document.documentElement as any)['outerHTML'] as string;
        const liteOutput = this.serializer.serializeNode(document.documentElement);
        nativeParsed.push([name, input, nativeOutput]);
        liteParsed.push([name, input, liteOutput]);
      }
      nativeData[suiteName] = nativeParsed;
      liteData[suiteName] = liteParsed;
    }
    this.nativeData = nativeData;
    this.liteData = liteData;
  }
}

let samples = await loadAllSamples(sampleNames);
let runner = new Runner(samples);
runner.run();

(globalThis as any)['nativeData'] = runner.nativeData;
(globalThis as any)['liteData'] = runner.liteData;
(globalThis as any)['sampleNames'] = sampleNames;
(globalThis as any)['Runner'] = Runner;
(globalThis as any)['loadAllSamples'] = loadAllSamples;
