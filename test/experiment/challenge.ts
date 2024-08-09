import * as fs from 'fs';
import {JSDOM} from 'jsdom';
import {hrtime} from 'node:process';
import {SelfClosingOptions, Serializer} from '../../src/impl/Serializer.js';
import {HtmlLite} from '../../src/index.js';

const projectRoot = 'D:/Dev/Idea/workspace/my-xml-lite/';
const challengeRoot = projectRoot + 'etc/experiment/';
const srcPath = 'HTML_Standard.html';
const litePath = 'out/HTML_Standard_lite.html';
const jsdomPath = 'out/HTML_Standard_jsdom.html';
const html: string = fs.readFileSync(challengeRoot + srcPath, {encoding: 'utf-8'});

let now = hrtime.bigint();
const liteDoc = HtmlLite.parseString(html);
const liteTime = hrtime.bigint() - now;
now = hrtime.bigint();
const jsdomContext = new JSDOM(html);
const jsdomTime = hrtime.bigint() - now;

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

fs.writeFileSync(challengeRoot + litePath, serializer.serializeNode(liteDoc), {encoding: 'utf-8'});
fs.writeFileSync(challengeRoot + jsdomPath, jsdomContext.serialize(), {encoding: 'utf-8'});

console.log(`Lite: ${liteTime} (${Number(jsdomTime * 100n / liteTime) / 100}x faster); JSDOM: ${jsdomTime}`);
