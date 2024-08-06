import {JSDOM} from 'jsdom';
import * as fs from 'node:fs/promises';
import {parseFromString} from '../../src/impl/parse.js';
import {SelfClosingOptions, Serializer} from '../../src/impl/Serializer.js';
import {DefaultRawTestCore} from '../composer/abstract-suite.js';

type ParsedCase = [string, string, string];
type SampleCollection = { [suite: string]: DefaultRawTestCore[] };

const sampleRoot = 'dist/test/composer/samples';
const saveRoot = 'test/browsers';

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
  let data = await fs.readFile(`${sampleRoot}/${name}.json`, {encoding: 'utf-8'});
  return JSON.parse(data) as DefaultRawTestCore[];
}

async function loadAllSamples(sampleNames: string[]): Promise<SampleCollection> {
  const data = await Promise.all(sampleNames.map(name => loadSampleFile(name)));
  const result: SampleCollection = {};
  for (let i = 0; i < sampleNames.length; ++i) {
    result[sampleNames[i]] = data[i];
  }
  return result;
}

async function saveFile(filename: string, data: { [suite: string]: ParsedCase[] }): Promise<void> {
  return fs.writeFile(`${saveRoot}/${filename}.json`, JSON.stringify(data, null, 2), {encoding: 'utf-8'});
}

export class RunnerVirtualDOM {
  samples: SampleCollection;
  jsdomNativeData!: { [suite: string]: ParsedCase[] };
  jsdomLiteData!: { [suite: string]: ParsedCase[] };
  liteData!: { [suite: string]: ParsedCase[] };
  liteRootData!: { [suite: string]: ParsedCase[] };
  serializer: Serializer;

  constructor(samples: SampleCollection) {
    this.samples = samples;
    this.serializer = new Serializer({
      htmlVoidSelfClose: SelfClosingOptions.SKIP,
      foreignVoidSelfClose: SelfClosingOptions.SKIP,
      escapeSingleQuoteInAttribute: false,
      omitEmptyAttributeValue: false,
      keepCDataSections: false
    });
  }

  run() {
    const jsdomNativeData: { [suite: string]: ParsedCase[] } = {};
    const jsdomLiteData: { [suite: string]: ParsedCase[] } = {};
    const liteData: { [suite: string]: ParsedCase[] } = {};
    const liteRootData: { [suite: string]: ParsedCase[] } = {};
    for (let suiteName in this.samples) {
      const suite = this.samples[suiteName];
      const jsdomNativeParsed: ParsedCase[] = [];
      const jsdomLiteParsed: ParsedCase[] = []
      const liteParsed: ParsedCase[] = [];
      const liteRootParsed: ParsedCase[] = [];
      for (let testCase of suite) {
        const name = testCase[0];
        const input = testCase[1];
        const jsdom = new JSDOM(input);
        const jsdomDocument = jsdom.window.document;
        const liteDocument = parseFromString(input);
        const jsdomNativeOutput = jsdom.serialize();
        const jsdomLiteOutput = this.serializer.serializeNode(jsdomDocument);
        const liteFullOutput = this.serializer.serializeNode(liteDocument);
        const liteRootOutput = this.serializer.serializeNode(liteDocument.documentElement);
        jsdomNativeParsed.push([name, input, jsdomNativeOutput]);
        jsdomLiteParsed.push([name, input, jsdomLiteOutput]);
        liteParsed.push([name, input, liteFullOutput]);
        liteRootParsed.push([name, input, liteRootOutput]);
      }
      jsdomNativeData[suiteName] = jsdomNativeParsed;
      jsdomLiteData[suiteName] = jsdomLiteParsed;
      liteData[suiteName] = liteParsed;
      liteRootData[suiteName] = liteRootParsed;
    }
    this.jsdomNativeData = jsdomNativeData;
    this.jsdomLiteData = jsdomLiteData;
    this.liteData = liteData;
    this.liteRootData = liteRootData;
  }
}

let samples = await loadAllSamples(sampleNames);
let runner = new RunnerVirtualDOM(samples);
runner.run();

await Promise.all([
  saveFile('jsdom-native', runner.jsdomNativeData),
  saveFile('jsdom-lite', runner.jsdomLiteData),
  saveFile('lite', runner.liteData),
  saveFile('lite-root', runner.liteRootData)
]);
