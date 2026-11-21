import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask, completeTask, openTasks} from '../src/tasks.js';

test('createTask trims the title and starts open', () => {
  const t = createTask('  write spec ');
  assert.equal(t.title, 'write spec');
  assert.equal(t.completedAt, null);
});

test('createTask rejects empty titles and bad dates', () => {
  assert.throws(() => createTask(''));
  assert.throws(() => createTask('x', {due: 'not a date'}));
});

test('openTasks excludes completed tasks', () => {
  const a = createTask('a'), b = completeTask(createTask('b'));
  assert.deepEqual(openTasks([a, b]).map(t => t.title), ['a']);
});
