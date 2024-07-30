import {Document} from '../../src/decl/xml-lite-decl.js';
import {serialize} from '../../src/impl/Serializer.js';
import {DefaultRawTestCore} from '../composer/abstract-suite.js';
import {
  afterAfterBody,
  afterAfterFrameset,
  afterBody,
  afterFrameset,
  afterHead,
  beforeHead,
  beforeHtml,
  foreignAttributes,
  formatting,
  inBody,
  inCaption,
  inCell,
  inColumnGroup,
  inForeignContent,
  inFrameset,
  inHead,
  inHeadNoscript,
  inRow,
  inSelect,
  inSelectCommon,
  inSelectInTable,
  inSelectInTableSpecial,
  inSelectInTd,
  inTable,
  inTableBody,
  inTemplate
} from '../composer/samples/index.js';

interface DOMParser {
  parseFromString(string: string, type: 'text/html'): Document;
}

declare var DOMParser: {
  prototype: DOMParser;
  new(): DOMParser;
};

declare var globalThis: any;

type ParsedCase = [string, string, string];

const samples: { [suite: string]: DefaultRawTestCore[] } = {
  // initial has special handling
  afterAfterBody: afterAfterBody as DefaultRawTestCore[],
  afterAfterFrameset: afterAfterFrameset as DefaultRawTestCore[],
  afterBody: afterBody as DefaultRawTestCore[],
  afterFrameset: afterFrameset as DefaultRawTestCore[],
  afterHead: afterHead as DefaultRawTestCore[],
  beforeHead: beforeHead as DefaultRawTestCore[],
  beforeHtml: beforeHtml as DefaultRawTestCore[],
  foreignAttributes: foreignAttributes as DefaultRawTestCore[],
  formatting: formatting as DefaultRawTestCore[],
  inBody: inBody as DefaultRawTestCore[],
  inCaption: inCaption as DefaultRawTestCore[],
  inCell: inCell as DefaultRawTestCore[],
  inColumnGroup: inColumnGroup as DefaultRawTestCore[],
  inForeignContent: inForeignContent as DefaultRawTestCore[],
  inFrameset: inFrameset as DefaultRawTestCore[],
  inHead: inHead as DefaultRawTestCore[],
  inHeadNoscript: inHeadNoscript as DefaultRawTestCore[],
  inRow: inRow as DefaultRawTestCore[],
  inSelect: inSelect as DefaultRawTestCore[],
  inSelectCommon: inSelectCommon as DefaultRawTestCore[],
  inSelectInTable: inSelectInTable as DefaultRawTestCore[],
  inSelectInTableSpecial: inSelectInTableSpecial as DefaultRawTestCore[],
  inSelectInTd: inSelectInTd as DefaultRawTestCore[],
  inTable: inTable as DefaultRawTestCore[],
  inTableBody: inTableBody as DefaultRawTestCore[],
  inTemplate: inTemplate as DefaultRawTestCore[]
};

export class Runner {
  parser: DOMParser;
  data!: { [suite: string]: ParsedCase[] };

  constructor() {
    this.parser = new DOMParser();
  }

  run() {
    const data: { [suite: string]: ParsedCase[] } = {};
    for (let suiteName in samples) {
      const suite = samples[suiteName] as DefaultRawTestCore[];
      const parsed: ParsedCase[] = [];
      for (let testCase of suite) {
        const name = testCase[0];
        const input = testCase[1];
        const document = this.parser.parseFromString(input, 'text/html');
        const output = serialize(document);
        parsed.push([name, input, output]);
      }
      data[suiteName] = parsed;
    }
    return this.data = data;
  }
}

globalThis['Runner'] = Runner;