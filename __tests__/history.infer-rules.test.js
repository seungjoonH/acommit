import { inferRulesFromHistory, parseHistoryLog } from '../src/core/history/infer-rules.js';

describe('history rule inference', () => {
  test('parses bridge git log records with body and files', () => {
    const parsed = parseHistoryLog(`__ACOMMIT_RECORD__
abc123
Dev
dev@example.com
feat(core): 기능 추가
- 상세 내용
__ACOMMIT_FILES__
src/core/a.js
src/core/b.js`);

    expect(parsed).toEqual([{
      hash: 'abc123',
      author: 'Dev',
      email: 'dev@example.com',
      subject: 'feat(core): 기능 추가',
      body: '- 상세 내용',
      files: ['src/core/a.js', 'src/core/b.js'],
    }]);
  });

  test('infers supported rules and excludes bot and revert commits', () => {
    const commits = Array.from({ length: 12 }, (_, index) => ({
      hash: String(index),
      author: 'Dev',
      email: 'dev@example.com',
      subject: index < 8 ? `feat(core): 기능 ${index} 추가` : `fix(core): 오류 ${index} 수정`,
      body: '',
      files: [`src/core/file-${index}.js`, `src/core/test-${index}.js`],
    }));
    commits.push({ hash: 'bot', author: 'release[bot]', email: 'bot@example.com', subject: 'chore: release', body: '', files: ['package.json'] });
    commits.push({ hash: 'revert', author: 'Dev', email: 'dev@example.com', subject: 'Revert "feat: old"', body: '', files: ['src/old.js'] });

    const result = inferRulesFromHistory(commits);

    expect(result.commitsAnalyzed).toBe(12);
    expect(result.excluded).toMatchObject({ bots: 1, reverts: 1 });
    expect(result.sufficientSample).toBe(true);
    expect(result.suggestedRules.message.lang).toBe('ko');
    expect(result.suggestedRules.tags.list).toEqual(['feat', 'fix']);
    expect(result.suggestedRules.grouping.mode).toBe('by-directory');
    expect(result.suggestedRules.conventional.compatible).toBe(true);
    expect(result.suggestedRules.conventional.scope.enabled).toBe(true);
  });
});
