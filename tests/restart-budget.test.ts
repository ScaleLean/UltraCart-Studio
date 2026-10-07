import test from 'node:test';
import assert from 'node:assert/strict';
import { RestartBudget } from '../src/main/restart-budget';

test('restart budget allows three restarts per window and recovers after it', () => {
  const budget = new RestartBudget(3, 1000);
  assert.deepEqual([0, 100, 200, 300].map((at) => budget.take(at)), [true, true, true, false]);
  assert.equal(budget.take(999), false);
  assert.equal(budget.take(1000), true);
});

test('manual reset restores the full budget', () => {
  const budget = new RestartBudget(1, 1000);
  assert.equal(budget.take(0), true);
  assert.equal(budget.take(1), false);
  budget.reset();
  assert.equal(budget.take(2), true);
});
