// Run with:  node tests/format.test.mjs
import assert from 'assert';
import { fmt, fmtRate, fmtTime } from '../js/format.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (err) { failures.push(name + '\n    ' + err.message); }
}

test('small numbers are plain integers', () => {
  assert.strictEqual(fmt(0), '0');
  assert.strictEqual(fmt(7.9), '7');
  assert.strictEqual(fmt(999), '999');
  assert.strictEqual(fmt(999.9), '999');
});

test('thousands and up keep three significant figures', () => {
  assert.strictEqual(fmt(1000), '1.00K');
  assert.strictEqual(fmt(1234), '1.23K');
  assert.strictEqual(fmt(12345), '12.3K');
  assert.strictEqual(fmt(123456), '123K');
  assert.strictEqual(fmt(1.5e6), '1.50M');
  assert.strictEqual(fmt(2.5e9), '2.50B');
  assert.strictEqual(fmt(7e12), '7.00T');
  assert.strictEqual(fmt(1e15), '1.00Qa');
});

test('rounding never spills into the next suffix', () => {
  assert.strictEqual(fmt(999600), '999K');
  assert.strictEqual(fmt(999999), '999K');
});

test('rates show one decimal below a hundred', () => {
  assert.strictEqual(fmtRate(0.5), '0.5');
  assert.strictEqual(fmtRate(8.24), '8.2');
  assert.strictEqual(fmtRate(12), '12');
  assert.strictEqual(fmtRate(1500), '1.50K');
});

test('durations read naturally', () => {
  assert.strictEqual(fmtTime(12), '12s');
  assert.strictEqual(fmtTime(185), '3m 05s');
  assert.strictEqual(fmtTime(7800), '2h 10m');
  assert.strictEqual(fmtTime(-1), '--');
});

console.log(passed + ' passed, ' + failures.length + ' failed');
for (const f of failures) console.log('  FAIL ' + f);
process.exit(failures.length ? 1 : 0);
