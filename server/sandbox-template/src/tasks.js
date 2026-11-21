// Task Tracker — sandbox product for ATLAS employees.
let counter = 0;

export function createTask(title, {due = null} = {}) {
  if (typeof title !== 'string' || !title.trim()) throw new TypeError('title is required');
  if (due !== null && Number.isNaN(Date.parse(due))) throw new TypeError('due must be an ISO date');
  counter += 1;
  return {id: counter, title: title.trim(), due, completedAt: null};
}

export function completeTask(task, at = new Date().toISOString()) {
  return {...task, completedAt: at};
}

export function openTasks(tasks) {
  return tasks.filter(t => !t.completedAt);
}
