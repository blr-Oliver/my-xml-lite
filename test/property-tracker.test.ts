import {trackProperty} from './util/property-tracker';

const target = {x: 0};
const changes = trackProperty(target, 'x');

beforeEach(() => {
  changes.length = 0;
});
describe('basic', () => {
  it('test', () => {
    target.x = 1;
    target.x = 2;
    target.x = 1;
    expect(changes).toStrictEqual([1, 2, 1]);
  })
});