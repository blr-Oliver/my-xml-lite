import {BodyContentSuite, DefaultRawTest} from './abstract-suite';
import {default as rawTests} from './samples/in-table.json';

const suite = new BodyContentSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table mode', () => suite.createSuite());
