import {Document} from '../../src/decl/xml-lite-decl.js';
import {serialize} from '../../src/impl/Serializer.js';
import {DefaultRawTestCore} from '../composer/abstract-suite.js';

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
  'in-select-common',
  'in-select-in-table-special',
  'in-select-in-table',
  'in-select-in-td',
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
  data!: { [suite: string]: ParsedCase[] };

  constructor(samples: SampleCollection) {
    this.parser = new DOMParser();
    this.samples = samples;
  }

  run() {
    const data: { [suite: string]: ParsedCase[] } = {};
    for (let suiteName in this.samples) {
      const suite = this.samples[suiteName];
      const parsed: ParsedCase[] = [];
      for (let testCase of suite) {
        const name = testCase[0];
        const input = testCase[1];
        const document = this.parser.parseFromString(input, 'text/html');
        const output = serialize(document as unknown as Document);
        parsed.push([name, input, output]);
      }
      data[suiteName] = parsed;
    }
    return this.data = data;
  }
}

let samples = await loadAllSamples(sampleNames);
let runner = new Runner(samples);
let runResult = runner.run();

(globalThis as any)['runResult'] = runResult;
(globalThis as any)['sampleNames'] = sampleNames;
(globalThis as any)['Runner'] = Runner;
(globalThis as any)['loadAllSamples'] = loadAllSamples;
