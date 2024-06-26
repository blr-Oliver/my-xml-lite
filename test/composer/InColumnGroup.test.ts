import {BodyContentSuite, DefaultRawTest} from './abstract-suite';
import {default as rawTests} from './samples/in-column-group.json';

const suite = new BodyContentSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In column group mode', () => suite.createSuite());
