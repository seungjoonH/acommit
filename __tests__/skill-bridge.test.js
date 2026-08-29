import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  collect,
  finalizePlan,
  settingsGet,
  settingsSet,
  formatCommit,
  execute,
  analyzeHistory,
  applyInferredRules,
} from '../src/skill/bridge.mjs';

const execFileAsync = promisify(execFile);

async function makeRepo(rulesYaml) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'acommit-skill-'));
  await execFileAsync('git', ['init'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd });
  await execFileAsync('git', ['config', 'user.name', 'test'], { cwd });
  // .acommit/ itself shouldn't show up as a "file to commit" — mirror the real repo's .gitignore.
  await fs.writeFile(path.join(cwd, '.gitignore'), '.acommit/\n', 'utf8');
  if (rulesYaml) {
    await fs.mkdir(path.join(cwd, '.acommit'), { recursive: true });
    await fs.writeFile(path.join(cwd, '.acommit', 'rules.yml'), rulesYaml, 'utf8');
  }
  // Commit the baseline (.gitignore + rules.yml) so only files written by
  // individual tests afterward show up as "changed".
  await execFileAsync('git', ['add', '.gitignore'], { cwd });
  await execFileAsync('git', ['commit', '-m', 'baseline', '--allow-empty'], { cwd });
  return cwd;
}

async function writeFile(cwd, rel, content) {
  const full = path.join(cwd, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
}

describe('skill bridge: collect()', () => {
  test('per-file mode returns mode "ready" with one generatePlans entry per file', async () => {
    const cwd = await makeRepo('grouping:\n  mode: per-file\n');
    try {
      await writeFile(cwd, 'a.js', 'console.log("a");\n');
      await writeFile(cwd, 'b.js', 'console.log("b");\n');

      const res = await collect({ cwd });
      expect(res.mode).toBe('ready');
      expect(res.files.sort()).toEqual(['a.js', 'b.js']);
      expect(res.plan.groups).toHaveLength(2);
      expect(res.generatePlans).toHaveLength(2);
      for (const gp of res.generatePlans) {
        expect(typeof gp.system).toBe('string');
        expect(typeof gp.user).toBe('string');
      }
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('by-similarity mode returns mode "needs-grouping" with a grouping prompt, no LLM call', async () => {
    const cwd = await makeRepo('grouping:\n  mode: by-similarity\n  minFilesPerGroup: 1\n');
    try {
      await writeFile(cwd, 'src/a.js', 'console.log("a");\n');
      await writeFile(cwd, 'src/b.js', 'console.log("b");\n');

      const res = await collect({ cwd });
      expect(res.mode).toBe('needs-grouping');
      expect(res.draftPlan.groups.length).toBeGreaterThan(0);
      expect(res.groupingPrompt.system).toEqual(expect.stringContaining('grouping'));
      expect(res.groupingPrompt.user).toEqual(expect.stringContaining('CHANGED FILES'));
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('returns mode "no-changes" when nothing is staged/modified', async () => {
    const cwd = await makeRepo();
    try {
      const res = await collect({ cwd });
      expect(res.mode).toBe('no-changes');
      expect(res.files).toEqual([]);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('flags an unprotected sensitive .env file', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(cwd, '.env', 'SECRET=abc\n');
      const res = await collect({ cwd });
      expect(res.envGuard.sensitiveFiles).toContain('.env');
      expect(res.envGuard.unprotected).toContain('.env');
      expect(res.envGuard.missingPatterns).toEqual(expect.arrayContaining(['.env.*', '!.env.example']));
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('does not flag .env once .gitignore protects it', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(cwd, '.env', 'SECRET=abc\n');
      await writeFile(cwd, '.gitignore', '.env\n.env.*\n!.env.example\n');
      const res = await collect({ cwd });
      expect(res.envGuard.unprotected).toEqual([]);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('skill bridge: finalizePlan()', () => {
  test('validates and repairs the agent-provided grouping JSON', async () => {
    const cwd = await makeRepo('grouping:\n  mode: by-similarity\n  minFilesPerGroup: 1\n');
    try {
      await writeFile(cwd, 'a.js', 'console.log("a");\n');
      await writeFile(cwd, 'b.js', 'console.log("b");\n');

      const agentText = JSON.stringify({
        groups: [
          { files: ['a.js'], tag: null, rationale: 'a' },
          { files: ['b.js'], tag: null, rationale: 'b' },
        ],
      });
      const res = await finalizePlan({ cwd, agentText });
      expect(res.mode).toBe('ready');
      expect(res.plan.groups.map((g) => g.files).flat().sort()).toEqual(['a.js', 'b.js']);
      expect(res.generatePlans).toHaveLength(2);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('repairs a plan that omits a changed file instead of failing outright', async () => {
    const cwd = await makeRepo('grouping:\n  mode: by-similarity\n  minFilesPerGroup: 1\n');
    try {
      await writeFile(cwd, 'a.js', 'console.log("a");\n');
      await writeFile(cwd, 'b.js', 'console.log("b");\n');

      const agentText = JSON.stringify({
        groups: [{ files: ['a.js'], tag: null, rationale: 'a' }],
      });
      const res = await finalizePlan({ cwd, agentText });
      expect(res.mode).toBe('ready');
      expect(res.plan.groups.flatMap((g) => g.files).sort()).toEqual(['a.js', 'b.js']);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('skill bridge: settings-get / settings-set', () => {
  test('starts unset and persists answers without clobbering other rules.yml fields', async () => {
    const cwd = await makeRepo('message:\n  lang: en\n');
    try {
      const before = await settingsGet({ cwd });
      expect(before.skill).toEqual({
        autoExecuteGit: null,
        autoPush: null,
        envGuardMode: null,
        confirmPlanBeforeGenerate: null,
      });

      await settingsSet({ cwd, key: 'autoExecuteGit', value: false });
      await settingsSet({ cwd, key: 'envGuardMode', value: 'ask' });

      const after = await settingsGet({ cwd });
      expect(after.skill.autoExecuteGit).toBe(false);
      expect(after.skill.envGuardMode).toBe('ask');
      expect(after.skill.autoPush).toBeNull();

      const raw = await fs.readFile(path.join(cwd, '.acommit', 'rules.yml'), 'utf8');
      expect(raw).toContain('lang: en');
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('rejects unknown settings and invalid values', async () => {
    const cwd = await makeRepo();
    try {
      await expect(settingsSet({ cwd, key: 'unknown', value: true }))
        .rejects.toThrow('Unknown skill setting');
      await expect(settingsSet({ cwd, key: 'autoPush', value: 'yes' }))
        .rejects.toThrow('Invalid value');
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('skill bridge: formatCommit()', () => {
  test('parses agent-generated text into CLI-parity shell commands', async () => {
    const cwd = await makeRepo();
    try {
      const text = 'test: 예시 커밋\n\ngit add a.js\ngit commit -m "test: 예시 커밋"';
      const res = await formatCommit({ cwd, text, files: ['a.js'] });
      expect(res.tag).toBe('test');
      expect(res.commitMessage).toBe('test: 예시 커밋');
      expect(res.shell).toEqual(
        expect.arrayContaining(['git add a.js', 'git commit -m "test: 예시 커밋"']),
      );
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('rejects a generated message that violates configured rules', async () => {
    const cwd = await makeRepo('tags:\n  enabled: true\n  list: [feat, fix]\n');
    try {
      await expect(formatCommit({
        cwd,
        text: 'chore: disallowed tag',
        files: ['a.js'],
      })).rejects.toThrow('Generated commit message violates rules');
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('skill bridge: execute()', () => {
  test('runs git add + git commit for the given files', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(cwd, 'a.js', 'console.log("a");\n');
      const res = await execute({ cwd, files: ['a.js'], message: 'test: add a.js' });
      expect(res.committed).toBe(true);
      expect(res.pushed).toBe(false);

      const { stdout } = await execFileAsync('git', ['log', '--oneline'], { cwd });
      expect(stdout).toContain('test: add a.js');
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('commits only the requested files and preserves unrelated staged changes', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(cwd, 'a.js', 'console.log("a");\n');
      await writeFile(cwd, 'b.js', 'console.log("b");\n');
      await execFileAsync('git', ['add', 'a.js'], { cwd });

      await execute({ cwd, files: ['b.js'], message: 'test: add b.js' });

      const { stdout: committed } = await execFileAsync(
        'git', ['show', '--pretty=', '--name-only', 'HEAD'], { cwd },
      );
      expect(committed.trim().split('\n')).toEqual(['b.js']);

      const { stdout: staged } = await execFileAsync(
        'git', ['diff', '--cached', '--name-only'], { cwd },
      );
      expect(staged.trim().split('\n')).toEqual(['a.js']);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('skill bridge: infer rules', () => {
  test('analyzes repository history without an LLM call', async () => {
    const cwd = await makeRepo();
    try {
      for (let index = 0; index < 10; index += 1) {
        await writeFile(cwd, `src/file-${index}.js`, `export const value = ${index};\n`);
        await execFileAsync('git', ['add', '.'], { cwd });
        await execFileAsync('git', ['commit', '-m', `feat(core): 기능 ${index} 추가`], { cwd });
      }
      const result = await analyzeHistory({ cwd, maxCount: 50 });
      expect(result.sufficientSample).toBe(true);
      expect(result.suggestedRules.tags.list).toContain('feat');
      expect(result.evidence.taggedMessages.matched).toBeGreaterThanOrEqual(10);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  test('backs up and merges approved inferred rules', async () => {
    const cwd = await makeRepo('message:\n  lang: en\nllm:\n  provider: openrouter\n');
    try {
      const result = await applyInferredRules({
        cwd,
        rules: { message: { lang: 'ko' }, grouping: { mode: 'by-directory' } },
      });
      expect(result.applied).toBe(true);
      expect(result.backedUp).toBe(true);
      const raw = await fs.readFile(path.join(cwd, '.acommit', 'rules.yml'), 'utf8');
      const backup = await fs.readFile(path.join(cwd, '.acommit', 'rules.yml.bak'), 'utf8');
      expect(raw).toContain('lang: ko');
      expect(raw).toContain('provider: openrouter');
      expect(backup).toContain('lang: en');
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});
