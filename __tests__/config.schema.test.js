import { normalize, DEFAULTS } from '../src/core/config/schema.js';

describe('normalize()', () => {
  test('returns DEFAULTS when called with empty object', () => {
    const cfg = normalize({});
    expect(cfg.message.lang).toBe('ko');
    expect(cfg.tags.enabled).toBe(true);
    expect(cfg.tags.separator).toBe(': ');
    expect(cfg.tags.style).toBe('{tag}');
    expect(cfg.grouping.mode).toBe('per-file');
    expect(typeof cfg.tags.render).toBe('function');
  });

  describe('tags.style template parser', () => {
    test('{tag}: legacy migrates to {tag} + : separator', () => {
      for (const sep of [': ', ' ', ':']) {
        const cfg = normalize({ tags: { style: '{tag}:', separator: sep } });
        expect(cfg.tags.style).toBe('{tag}');
        expect(cfg.tags.separator).toBe(': ');
        expect(cfg.tags.render('feat')).toBe('feat');
      }
    });

    test('{TAG}: → uppercase', () => {
      const cfg = normalize({ tags: { style: '[{TAG}]' } });
      expect(cfg.tags.render('feat')).toBe('[FEAT]');
      expect(cfg.tags.render('fix')).toBe('[FIX]');
    });

    test('{Tag}: → capitalized', () => {
      const cfg = normalize({ tags: { style: '{Tag}:' } });
      expect(cfg.tags.render('feat')).toBe('Feat:');
    });

    test('{sep} expands to separator', () => {
      const cfg = normalize({ tags: { style: '{tag}:{sep}', separator: ' ' } });
      expect(cfg.tags.render('feat')).toBe('feat: ');
    });

    test('{scope} expands to scope arg', () => {
      const cfg = normalize({ tags: { style: '{tag}({scope}):' } });
      expect(cfg.tags.render('feat', 'auth')).toBe('feat(auth):');
      expect(cfg.tags.render('fix', '')).toBe('fix:');
    });

    test('template with no placeholders is returned as-is', () => {
      const cfg = normalize({ tags: { style: 'PREFIX:' } });
      expect(cfg.tags.render('feat')).toBe('PREFIX:');
    });
  });

  describe('tags.style fallback (no style → case + bracket)', () => {
    test('bracket=square + case=upper', () => {
      const cfg = normalize({ tags: { style: '', case: 'upper', bracket: 'square' } });
      expect(cfg.tags.render('feat')).toBe('[FEAT]');
    });

    test('bracket=round + case=capitalize', () => {
      const cfg = normalize({ tags: { style: '', case: 'capitalize', bracket: 'round' } });
      expect(cfg.tags.render('feat')).toBe('(Feat)');
    });

    test('bracket=none — tag only, separator added separately', () => {
      const cfg = normalize({ tags: { style: '', case: 'lower', bracket: 'none', separator: ': ' } });
      expect(cfg.tags.render('feat')).toBe('feat');
    });
  });

  describe('message.language alias', () => {
    test('message.language maps to message.lang', () => {
      const cfg = normalize({ message: { language: 'en' } });
      expect(cfg.message.lang).toBe('en');
    });

    test('message.lang takes precedence over message.language', () => {
      const cfg = normalize({ message: { lang: 'en', language: 'ko' } });
      expect(cfg.message.lang).toBe('en');
    });
  });

  describe('message.lines validation', () => {
    test('invalid value falls back to single', () => {
      const cfg = normalize({ message: { lines: 'triple' } });
      expect(cfg.message.lines).toBe('single');
    });
  });

  describe('grouping validation', () => {
    test('invalid mode falls back to per-file', () => {
      const cfg = normalize({ grouping: { mode: 'invalid' } });
      expect(cfg.grouping.mode).toBe('per-file');
    });

    test('threshold clamped to [0,1]', () => {
      expect(normalize({ grouping: { threshold: 5 } }).grouping.threshold).toBe(1);
      expect(normalize({ grouping: { threshold: -1 } }).grouping.threshold).toBe(0);
    });
  });

  describe('message.style vs message.lang', () => {
    test('coerces invalid style for Korean to verb', () => {
      const cfg = normalize({ message: { lang: 'ko', style: 'imperative' } });
      expect(cfg.message.style).toBe('verb');
    });

    test('coerces invalid style for English to imperative', () => {
      const cfg = normalize({ message: { lang: 'en', style: 'verb' } });
      expect(cfg.message.style).toBe('imperative');
    });

    test('keeps valid style for each lang', () => {
      expect(normalize({ message: { lang: 'ko', style: 'declarative' } }).message.style).toBe('declarative');
      expect(normalize({ message: { lang: 'en', style: 'past' } }).message.style).toBe('past');
    });
  });

  describe('round-trip: normalize → serialize → normalize', () => {
    test('stable across two normalize passes', () => {
      const first = normalize({
        tags: { style: '[{TAG}]', list: ['feat', 'fix'], separator: ' ' },
        message: { lang: 'en', style: 'imperative', lines: 'multi', wrap: 80 },
        grouping: { mode: 'by-tag', minFilesPerGroup: 3 },
      });

      // Simulate YAML round-trip: extract serializable fields
      const serialized = {
        tags: {
          enabled: first.tags.enabled,
          list: first.tags.list,
          style: first.tags.style,
          separator: first.tags.separator,
          case: first.tags.case,
          bracket: first.tags.bracket,
        },
        message: {
          lang: first.message.lang,
          style: first.message.style,
          tone: first.message.tone,
          lines: first.message.lines,
          wrap: first.message.wrap,
          emoji: first.message.emoji,
        },
        grouping: {
          mode: first.grouping.mode,
          minFilesPerGroup: first.grouping.minFilesPerGroup,
          directoryDepth: first.grouping.directoryDepth,
          threshold: first.grouping.threshold,
          maxGroupSize: first.grouping.maxGroupSize,
        },
      };

      const second = normalize(serialized);

      expect(second.tags.render('feat')).toBe(first.tags.render('feat'));
      expect(second.message.lang).toBe(first.message.lang);
      expect(second.message.lines).toBe(first.message.lines);
      expect(second.grouping.mode).toBe(first.grouping.mode);
      expect(second.grouping.minFilesPerGroup).toBe(first.grouping.minFilesPerGroup);
    });
  });
});
