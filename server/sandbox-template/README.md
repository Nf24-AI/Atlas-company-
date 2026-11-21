# Task Tracker (ATLAS sandbox product)

A tiny dependency-free task library. ATLAS AI employees (Developer, QA) work on this repository
inside an isolated sandbox. Run the tests with `node --test`.

## API (src/tasks.js)
- `createTask(title, {due})` — new open task; `due` is an ISO date string or null.
- `completeTask(task, at)` — returns a completed copy.
- `openTasks(tasks)` — tasks not yet completed.
