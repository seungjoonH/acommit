import { normalize } from '../src/core/config/schema.js';
import { validateGeneratedCommit } from '../src/core/message/validate.js';

function parsed(subject, body = []) {
  return { subject, body, files: ['src/a.js'] };
}

describe('validateGeneratedCommit', () => {
  test('accepts an allowed tagged single-line message', () => {
    const cfg = normalize({
      tags: { enabled: true, list: ['feat', 'fix'] },
      message: { lines: 'single', wrap: 72 },
    });
    expect(validateGeneratedCommit(parsed('feat: add validation'), cfg)).toEqual({ ok: true, issues: [] });
  });

  test('rejects disallowed tags and a body in single-line mode', () => {
    const cfg = normalize({
      tags: { enabled: true, list: ['feat', 'fix'] },
      message: { lines: 'single' },
    });
    const result = validateGeneratedCommit(parsed('chore: add validation', ['extra detail']), cfg);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['tags.not-allowed', 'message.lines.single']),
    );
  });

  test('requires a body in multi-line mode', () => {
    const cfg = normalize({ message: { lines: 'multi' } });
    const result = validateGeneratedCommit(parsed('feat: add validation'), cfg);
    expect(result.issues.map((issue) => issue.code)).toContain('message.lines.multi');
  });
});
