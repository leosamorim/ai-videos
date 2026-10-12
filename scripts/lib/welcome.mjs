import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const STATE = '.local/welcome.json';

function optional(operation, fallback) {
  try { return operation(); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

/** Read-only, dependency-free first-use detection. Never load/migrate project state. */
export function welcomeState(root) {
  const entries = optional(() => readdirSync(join(root, 'videos'), { withFileTypes: true }), []);
  const hasProjects = entries.some((entry) =>
    (entry.isDirectory() || entry.isSymbolicLink()) &&
    optional(() => statSync(join(root, 'videos', entry.name, 'project.json')).isFile(), false));
  const text = optional(() => readFileSync(join(root, STATE), 'utf8'), null);
  let seen = false;
  if (text) {
    try { const data = JSON.parse(text); seen = data.schema === 1 && data.shown === true; }
    catch { /* An incomplete marker must not suppress the introduction. */ }
  }
  return { should_show: !hasProjects && !seen, has_projects: hasProjects, already_shown: seen };
}

/** Only call after the agent actually presented the introduction to the user. */
export function acknowledgeWelcome(root) {
  const state = welcomeState(root);
  if (!state.should_show) return state;
  const path = join(root, STATE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ schema: 1, shown: true, shown_at: new Date().toISOString() }) + '\n');
  return welcomeState(root);
}

export function welcomeMessage(root) {
  return readFileSync(join(root, 'templates', 'WELCOME.md'), 'utf8').trim();
}
