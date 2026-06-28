/** Init wizard copy — UI locale + rules.yml comment template language (not message.lang). */

import { normalizeLocale } from '../core/locale.js';

export { normalizeLocale };

const STRINGS = {
  en: {
    sessionTitle: 'acommit setup',
    locale: {
      step: '1/4',
      subtitle: 'Language',
      options: [
        { value: 'ko', label: 'Korean' },
        { value: 'en', label: 'English' },
      ],
    },
    setupMode: {
      step: '2/4',
      subtitle: 'rules.yml',
      options: [
        { value: 'configure', label: 'Configure now', hint: 'Walk through key options' },
        { value: 'skip', label: 'Use defaults', hint: 'Template rules.yml, skip the wizard' },
      ],
    },
    messageLang: {
      step: '3/4',
      subtitle: 'Commit message language',
      options: [
        { value: 'ko', label: 'Korean (ko)' },
        { value: 'en', label: 'English (en)' },
      ],
    },
    messageLines: {
      step: '3/4',
      subtitle: 'Commit message format',
      options: [
        { value: 'single', label: 'Single line (subject only)' },
        { value: 'multi', label: 'Multi line (subject + bullets)' },
      ],
    },
    messageStyleKo: {
      step: '3/4',
      subtitle: 'Commit message style',
      options: [
        { value: 'verb', label: 'Verb (concise)', hint: '초기 설정 추가' },
        { value: 'declarative', label: 'Declarative', hint: '초기 설정을 추가함' },
      ],
    },
    messageStyleEn: {
      step: '3/4',
      subtitle: 'Commit message style',
      options: [
        { value: 'imperative', label: 'Imperative', hint: 'Add initial setup' },
        { value: 'past', label: 'Past tense', hint: 'Added initial setup' },
      ],
    },
    grouping: {
      step: '3/4',
      subtitle: 'Grouping',
      options: [
        { value: 'per-file', label: 'One commit per file' },
        { value: 'by-similarity', label: 'Group by similarity', hint: 'recommended' },
        { value: 'by-tag', label: 'Group by tag' },
        { value: 'by-directory', label: 'Group by directory' },
        { value: 'none', label: 'No grouping (message only)' },
      ],
    },
    tags: {
      step: '3/4',
      subtitle: 'Tag prefix',
      options: [
        { value: 'yes', label: 'Enabled', hint: 'feat: message' },
        { value: 'no', label: 'Disabled', hint: 'message only' },
      ],
    },
    llm: { step: '3/4' },
    conventional: {
      step: '3/4',
      subtitle: 'Conventional Commits',
      options: [
        { value: 'no', label: 'Off', hint: 'feat: message' },
        { value: 'yes', label: 'On', hint: 'type(scope): format' },
      ],
    },
    scope: {
      step: '3/4',
      subtitle: 'Scope',
      options: [
        { value: 'no', label: 'No scope', hint: 'feat: message' },
        { value: 'yes', label: 'Use scope', hint: 'infer from path' },
      ],
    },
    gitignore: {
      step: '4/4',
      subtitle: '.gitignore',
      options: [
        { value: 'none', label: 'Do not add', hint: 'commit rules.yml to the team repo' },
        { value: 'results', label: 'Add .acommit/results/ only', hint: 'share rules.yml, ignore output' },
        { value: 'all', label: 'Add .acommit/', hint: 'local only (rules.yml excluded too)' },
      ],
    },
    llmPick: {
      connection: 'Connection',
      vendorDirect: 'API vendor',
      vendorOpenRouter: 'OpenRouter vendor',
      model: 'Model',
      custom: 'Custom…',
      customVendorDirect: 'Custom API provider',
      customVendorOpenRouter: 'Custom OpenRouter vendor prefix',
      customModel: 'Custom model id',
      required: 'Required',
    },
    cancel: 'Setup cancelled.',
    created: 'Created:',
    defaultRulesHint: 'Default rules.yml — run `acommit rules` to customize.',
    finishConfigured: 'Setup complete.',
    finishDefaults: 'Setup complete (defaults).',
    gitignoreAlready: (entry) => `.gitignore (already had ${entry})`,
    modelCmd: {
      title: 'acommit',
      cancel: 'Selection cancelled.',
    },
    localeCmd: {
      title: 'acommit locale',
      subtitle: 'UI language',
      options: [
        { value: 'ko', label: '한국어 (Korean)' },
        { value: 'en', label: 'English' },
      ],
      saved: (l) => `Locale set to ${l}.`,
      current: (l) => `Current locale: ${l}`,
      cancel: 'Cancelled.',
    },
    cli: {
      noChanges: 'No changes detected.',
      noClient: 'No LLM client available.',
      processing: (n) => `Collecting diffs for ${n} changed file${n !== 1 ? 's' : ''}...`,
      grouped: (files, groups, mode) =>
        `${files} file${files !== 1 ? 's' : ''} → ${groups} commit group${groups !== 1 ? 's' : ''} (${mode ?? 'per-file'})`,
      planning: 'Planning commit groups...',
      planSource: (source) => `Plan: ${source === 'llm' ? 'LLM intent grouping' : 'rules'}`,
      planRepaired: (n) => `Plan auto-repaired (${n} fix${n !== 1 ? 'es' : ''} from draft)`,
      planFailed: (msg) => `Grouping plan failed: ${msg}`,
      using: (llm, n) => `Using ${llm}  ·  ${n} commit${n !== 1 ? 's' : ''}`,
      initClient: (llm) => `Initializing LLM client (${llm})...`,
      ready: 'ready.',
      failed: 'failed.',
      generating: (i, n) => `Generating commit ${i}/${n}...`,
      done: 'done.',
      groupFailed: (i, msg) => `Group ${i} failed: ${msg}`,
      tokens: 'Estimated prompt tokens:',
      saved: (p) => `Result saved: ${p}`,
      initFailed: (provider, pkg) =>
        `Failed to initialize LLM provider '${provider}'. Install the SDK (npm install ${pkg}) and set API keys in .env.`,
    },
  },
  ko: {
    sessionTitle: 'acommit 설정',
    locale: {
      step: '1/4',
      subtitle: '언어',
      options: [
        { value: 'ko', label: '한국어' },
        { value: 'en', label: 'English' },
      ],
    },
    setupMode: {
      step: '2/4',
      subtitle: 'rules.yml',
      options: [
        { value: 'configure', label: '지금 설정하기', hint: '주요 옵션 선택' },
        { value: 'skip', label: '기본값 사용', hint: '템플릿 rules.yml, wizard 생략' },
      ],
    },
    messageLang: {
      step: '3/4',
      subtitle: '커밋 메시지 언어',
      options: [
        { value: 'ko', label: '한국어 (ko)' },
        { value: 'en', label: 'English (en)' },
      ],
    },
    messageLines: {
      step: '3/4',
      subtitle: '커밋 메시지 형식',
      options: [
        { value: 'single', label: '한 줄 (subject만)' },
        { value: 'multi', label: '여러 줄 (subject + bullets)' },
      ],
    },
    messageStyleKo: {
      step: '3/4',
      subtitle: '커밋 메시지 문장 스타일',
      options: [
        { value: 'verb', label: '간결체 (verb)', hint: '초기 설정 추가' },
        { value: 'declarative', label: '서술체 (declarative)', hint: '초기 설정을 추가함' },
      ],
    },
    messageStyleEn: {
      step: '3/4',
      subtitle: '커밋 메시지 문장 스타일',
      options: [
        { value: 'imperative', label: '명령형 (imperative)', hint: 'Add initial setup' },
        { value: 'past', label: '과거형 (past)', hint: 'Added initial setup' },
      ],
    },
    grouping: {
      step: '3/4',
      subtitle: '커밋 묶기 (grouping)',
      options: [
        { value: 'per-file', label: '파일별 1커밋' },
        { value: 'by-similarity', label: '유사도로 묶기', hint: '권장' },
        { value: 'by-tag', label: '태그별로 묶기' },
        { value: 'by-directory', label: '디렉터리별로 묶기' },
        { value: 'none', label: '묶지 않음 (메시지만)' },
      ],
    },
    tags: {
      step: '3/4',
      subtitle: '태그 prefix',
      options: [
        { value: 'yes', label: '사용', hint: 'feat: 메시지' },
        { value: 'no', label: '사용 안 함', hint: '태그 없이 메시지만' },
      ],
    },
    llm: { step: '3/4' },
    conventional: {
      step: '3/4',
      subtitle: 'Conventional Commits',
      options: [
        { value: 'no', label: '끄기', hint: 'feat: 메시지' },
        { value: 'yes', label: '켜기', hint: 'type(scope): 형식' },
      ],
    },
    scope: {
      step: '3/4',
      subtitle: 'Scope',
      options: [
        { value: 'no', label: 'scope 없음', hint: 'feat: 메시지' },
        { value: 'yes', label: 'scope 사용', hint: '경로에서 자동 추론' },
      ],
    },
    gitignore: {
      step: '4/4',
      subtitle: '.gitignore',
      options: [
        { value: 'none', label: '추가하지 않음', hint: 'rules.yml을 팀 repo에 커밋' },
        { value: 'results', label: '.acommit/results/ 만 추가', hint: 'rules.yml 공유, 결과만 제외' },
        { value: 'all', label: '.acommit/ 전체 추가', hint: '로컬 전용' },
      ],
    },
    llmPick: {
      connection: '연결 방식',
      vendorDirect: 'API 벤더',
      vendorOpenRouter: 'OpenRouter 벤더',
      model: '모델',
      custom: '직접 입력…',
      customVendorDirect: '직접 입력 API provider',
      customVendorOpenRouter: '직접 입력 OpenRouter vendor',
      customModel: '직접 입력 model id',
      required: '값을 입력하세요',
    },
    cancel: '설정을 취소했습니다.',
    created: '생성됨:',
    defaultRulesHint: '기본 rules.yml — `acommit rules`로 편집할 수 있습니다.',
    finishConfigured: '설정이 완료되었습니다.',
    finishDefaults: '설정이 완료되었습니다 (기본값).',
    gitignoreAlready: (entry) => `.gitignore (이미 ${entry} 있음)`,
    modelCmd: {
      title: 'acommit',
      cancel: '선택을 취소했습니다.',
    },
    localeCmd: {
      title: 'acommit locale',
      subtitle: 'UI 언어',
      options: [
        { value: 'ko', label: '한국어 (Korean)' },
        { value: 'en', label: 'English' },
      ],
      saved: (l) => `언어가 ${l}로 설정되었습니다.`,
      current: (l) => `현재 언어: ${l}`,
      cancel: '취소했습니다.',
    },
    cli: {
      noChanges: '변경된 파일이 없습니다.',
      noClient: 'LLM 클라이언트를 사용할 수 없습니다.',
      processing: (n) => `변경 diff 수집 중 (${n}개 파일)...`,
      grouped: (files, groups, mode) =>
        `${files}개 파일 → 커밋 ${groups}그룹 (${mode ?? 'per-file'})`,
      planning: '커밋 그룹 계획 중...',
      planSource: (source) => `계획: ${source === 'llm' ? 'LLM 의도 기반 그룹' : '규칙'}`,
      planRepaired: (n) => `계획 자동 보정 (${n}건, 초안 기준)`,
      planFailed: (msg) => `그룹 계획 실패: ${msg}`,
      using: (llm, n) => `${llm}  ·  ${n}개 커밋`,
      initClient: (llm) => `LLM 클라이언트 초기화 중 (${llm})...`,
      ready: '준비 완료.',
      failed: '실패.',
      generating: (i, n) => `커밋 생성 중 ${i}/${n}...`,
      done: '완료.',
      groupFailed: (i, msg) => `그룹 ${i} 실패: ${msg}`,
      tokens: '예상 프롬프트 토큰:',
      saved: (p) => `결과 저장됨: ${p}`,
      initFailed: (provider, pkg) =>
        `LLM provider '${provider}' 초기화 실패. SDK를 설치하고 (npm install ${pkg}) .env에 API 키를 설정하세요.`,
    },
  },
};

/** Bilingual first-step labels before locale is chosen. */
export const LOCALE_PICK = {
  step: '1/4',
  subtitle: 'Language / 언어',
  options: [
    { value: 'ko', label: '한국어 (Korean)' },
    { value: 'en', label: 'English' },
  ],
};

export function initStrings(locale) {
  return STRINGS[normalizeLocale(locale) === 'en' ? 'en' : 'ko'];
}
