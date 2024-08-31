import * as fs from 'fs';
import {JSDOM} from 'jsdom';
import {hrtime} from 'node:process';
import {UTF16StringSource} from '../../src/impl/input/UTF16StringSource.js';
import {Document, HtmlLite} from '../../src/index.js';
import {parseFile} from '../../src/impl/parse-file.js';
import {SelfClosingOptions, Serializer} from '../../src/impl/Serializer.js';

type Measurement = { name: string, time: bigint };

const projectRoot = 'D:/Dev/Idea/workspace/my-xml-lite/';
const challengeRoot = projectRoot + 'etc/experiment/';
const srcPath = 'HTML_Standard.html';
const litePath = 'out/HTML_Standard_lite.html';
const jsdomPath = 'out/HTML_Standard_jsdom.html';

const reports: Measurement[] = [];

let now = hrtime.bigint();
const html: string = fs.readFileSync(challengeRoot + srcPath, {encoding: 'utf-8'});
reports.push({name: 'Read to string', time: hrtime.bigint() - now});

now = hrtime.bigint();
const buffer = fs.readFileSync(challengeRoot + srcPath);
reports.push({name: 'Read to buffer', time: hrtime.bigint() - now});

now = hrtime.bigint();
const jsdomContext = new JSDOM(html);
reports.push({name: 'JSDOM', time: hrtime.bigint() - now});
fs.writeFileSync(challengeRoot + jsdomPath, jsdomContext.serialize(), {encoding: 'utf-8'});

now = hrtime.bigint();
HtmlLite.parseString(html);
reports.push({name: 'Lite (string)', time: hrtime.bigint() - now});

now = hrtime.bigint();
HtmlLite.parseString(html);
reports.push({name: 'Lite (string, second pass)', time: hrtime.bigint() - now});

now = hrtime.bigint();
HtmlLite.parseString(html);
reports.push({name: 'Lite (string, third pass)', time: hrtime.bigint() - now});

now = hrtime.bigint();
const liteDoc16 = HtmlLite.parse(new UTF16StringSource(html));
reports.push({name: 'Lite (string, UTF-16)', time: hrtime.bigint() - now});

now = hrtime.bigint();
parseFile(challengeRoot + srcPath, null, (err, doc) => useDocument(doc!, 'Lite (file)'));
//parseFromStream(fs.createReadStream(challengeRoot + srcPath), doc => useDocument(doc, 'Lite (stream)'));

//reportTimes(reports);

function reportTimes(reports: Measurement[]): void {
  for (const report of reports)
    console.log(`${report.name}: ${Number(report.time / 100000n) / 10} ms`);
}

function useDocument(liteDoc: Document, reportName: string) {
  reports.push({name: reportName, time: hrtime.bigint() - now});
  const serializer = new Serializer({
    htmlVoidSelfClose: SelfClosingOptions.KEEP_SKIP,
    foreignVoidSelfClose: SelfClosingOptions.KEEP_SKIP,
    omitEmptyAttributeValue: true,
    escapeSingleQuoteInAttribute: true,
    keepCDataSections: false
  });

  console.log(liteDoc.querySelectorAll('#head').length);
  console.log(liteDoc.querySelectorAll('dd').length);
  console.log(liteDoc.getElementsByTagName('dd').length);
  console.log(liteDoc.querySelectorAll('.switch').length);
  console.log(liteDoc.querySelectorAll('.split #head~dl.switch').length);
  console.log(liteDoc.getElementsByName('viewport').length);
  console.log(liteDoc.body.textContent!.length);

  fs.writeFileSync(challengeRoot + litePath, serializer.serializeNode(liteDoc), {encoding: 'utf-8'});

  reportTimes(reports);
}
