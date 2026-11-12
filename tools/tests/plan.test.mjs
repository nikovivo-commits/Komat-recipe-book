// The sums behind planning tomorrow from covers.  node --test tools/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ctx = { window: {}, document: { addEventListener() {}, documentElement: { dataset: {} } }, localStorage: { getItem: () => null, setItem() {} }, navigator: {}, console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(root + 'js/core.js', 'utf8'), ctx, { filename: 'js/core.js' });
/* what app.js and data.js set up before the plan is loaded */
vm.runInContext('K.SHEETS = {}; K.D = {}; K.ui = {};', ctx);
vm.runInContext(readFileSync(root + 'js/plan.js', 'utf8'), ctx, { filename: 'js/plan.js' });
const K = ctx.K;

test('need is the quantity per 10 covers scaled to the covers', () => {
  assert.equal(K.planNeed({ q: 0.7, u: 'L' }, 65), 4.55);
  assert.equal(K.planNeed({ q: 250, u: 'g' }, 40), 1000);
  assert.equal(K.planNeed({ q: 0.7, u: 'L' }, 0), 0);
  assert.equal(K.planNeed(null, 65), 0);
});

test('make is what is missing, rounded up to a step a cook would weigh out', () => {
  assert.equal(K.planMake(4.55, 0, 'L'), 4.6);
  assert.equal(K.planMake(4.55, 1.2, 'L'), 3.4);
  assert.equal(K.planMake(1000, 0, 'g'), 1000);
  assert.equal(K.planMake(163, 0, 'g'), 170);
  assert.equal(K.planMake(6.5, 0, 'portions'), 7);
  assert.equal(K.planMake(0.3, 0, 'kg'), 0.3);
});

test('nothing to make when there is enough, never a negative amount', () => {
  assert.equal(K.planMake(4.55, 5, 'L'), 0);
  assert.equal(K.planMake(4.55, 4.55, 'L'), 0);
  assert.equal(K.planMake(0, 0, 'kg'), 0);
});

test('an amount to make is turned into batches of the recipe', () => {
  assert.equal(K.planFactor(4.5, 'L', '1.5', 'L'), 3);
  assert.equal(K.planFactor(2, 'kg', '500', 'g'), 4);
  assert.equal(K.planFactor(750, 'ml', '1', 'L'), 0.75);
  assert.equal(K.planFactor(12, 'portions', '6', 'portions'), 2);
  assert.equal(K.planFactor(12, 'portions', '6', 'portion'), 2);
  assert.equal(K.planFactor(2, 'kg', '1', 'L'), 0, 'weight and volume are not compared');
  assert.equal(K.planFactor(2, 'kg', '', 'kg'), 0, 'no yield, no scaling');
  assert.equal(K.planFactor(0, 'kg', '1', 'kg'), 0);
});
