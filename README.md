# acommit — AI 기반 커밋 메시지 자동화 CLI

Git 변경 내역을 분석해 LLM(Gemini, OpenAI 등)으로부터 일관된 커밋 메시지를 생성하는 도구입니다.  
프로젝트별 규칙을 `.acommit/rules.yml`로 관리하고, 결과를 `.acommit/results/`에 기록해 팀의 커밋 품질을 높여줍니다.

---

## 1. 빠른 시작

### 1) 설치 (clone → npm link)
```bash
git clone https://github.com/seungjoonH/acommit.git
cd acommit
npm install
npm link            # 전역 acommit 명령어 등록
```

### 2) 환경 변수 준비
루트에 `.env` 파일을 만들고 다음과 같이 채웁니다.

#### GEMINI 사용 시

```
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your_gemini_api_key
```

#### OPENAI 사용 시

```
OPENAI_MODEL=gpt-4o
OPENAI_API_KEY=your_openai_api_key
```
> `.env` 는 반드시 `.gitignore` 에 포함시키세요.  
> `set -o allexport; source .env; set +o allexport` 로 로컬 셸에 로드할 수 있습니다.

### 3) 설정 파일 생성
```bash
acommit init          # .acommit/rules.yml 템플릿 생성
```

### 4) 실행
```bash
acommit run
```
터미널에 메시지가 출력되고 `.acommit/results/<timestamp>.md` 에 기록됩니다.

---

## 2. 사용 가능한 명령어

| 명령 | 설명 | 예시 |
| --- | --- | --- |
| `acommit run` | Git 변경분을 분석하고 커밋 메시지를 생성합니다. | `acommit run` |
| `acommit prompt [--save]` | 보조 프롬프트를 입력하거나 저장합니다. | `acommit prompt -m "리팩터링임을 강조해줘"` |
| `acommit model` | 사용할 LLM 제공자를 선택/변경합니다. | `acommit model -p gemini` |
| `acommit init` | `.acommit/rules.yml` 템플릿과 `.gitignore` 를 생성합니다. | `acommit init --lang ko` |
| `acommit --help` | 전체 도움말과 전역 옵션을 확인합니다. | `acommit --help` |

### acommit run
- **용도**: 현재 Git 작업 트리의 변경 파일을 스캔하고 diff 기반 프롬프트를 생성해 LLM으로부터 커밋 메시지를 받습니다.
- **기본 사용법**: `acommit run`
- **입력**: 필요 시 `.acommit/last_prompt.json` (일회성 프롬프트), `.acommit/rules.yml`, 환경 변수.
- **출력**:
  - 진행률/스피너 로그
  - LLM 응답으로 구성된 메시지와 bullet 들
  - `git add`/`git commit` 명령 예시
  - 결과 파일 경로(`.acommit/results/<timestamp>.md`)
- **예시 출력**:
  ```
  [acommit] Processing 5 changed files...
  [acommit] Requesting LLM... done.

  feat: add CLI progress bar

  - add ProgressUI to visualize diff processing
  - wire run command to show spinner + counts

  git add src/ui/progress.js src/commands/run.js
  git commit -m "feat: add CLI progress bar"

  [acommit] Result saved at: .acommit/results/2025-11-08_17-59-16.md
  ```

### acommit prompt
- **용도**: LLM에게 전달할 추가 지시문을 입력합니다.
- **옵션**:
  - `-m, --message <msg>`: 에디터 없이 바로 문자열 입력.
  - `--save`: `.acommit/rules.yml` 의 `prompts` 배열에 영구 저장.
- **동작**:
  1. 기본값은 시스템 에디터(EDITOR, 없으면 `vi`)를 실행해 다중 줄 작성.
  2. `--save` 없으면 `.acommit/last_prompt.json` 에 저장되어 다음 `run` 한 번만 사용.
  3. `--save` 지정 시 규칙 파일에 추가되고 반복 사용.
- **입출력 예시**:
  ```
  $ acommit prompt -m "메인 페이지 구현에 관련된 커밋만 유지하고 나머지 커밋은 포함하지 말아줘"
  [info] Stored one-time prompt; it will be used by the next `acommit run`.
  ```
  ```
  $ acommit prompt --save
  # (에디터에서 작성 후 종료)
  [info] Saved prompt to .acommit/rules.yml under `prompts`.
  ```

### acommit model
- **용도**: LLM 제공자(Gemini/OpenAI)를 전환.
- **옵션**:
  - 기본: TTY 상에서 ↑↓ 로 이동, Enter 로 확정.
  - `-p, --provider <name>`: 비대화식 지정 (`gemini` 또는 `openai`).
- **동작**:
  1. 현재 `.acommit/rules.yml` 의 `llm.provider` 값을 읽음.
  2. 선택된 값을 덮어쓰고 저장.
  3. 필요한 환경 변수 안내 로그 출력.
- **예시**:
  ```
  $ acommit model
  Use ↑/↓ to choose a provider, Enter to confirm. Press Ctrl+C to cancel.
  * gemini (현재)
    openai
  ```
  ```
  $ acommit model -p openai
  [info] LLM 제공자를 'openai' 로 설정했습니다. OPENAI_API_KEY 와 (선택적으로) OPENAI_MODEL 환경 변수를 설정하세요.
  ```

### acommit init
- **용도**: 프로젝트에 필요한 설정 파일을 초기화.
- **옵션**:
  - `--lang <code>`: `ko` 또는 `en` 템플릿 선택 (기본 `ko`).
  - `-C, --cwd <path>`: 다른 디렉터리를 대상으로 실행.
- **동작**:
  1. `.acommit/rules.yml` 가 없으면 템플릿을 복사.
  2. `.gitignore` 에 `.acommit/` 와 `.env` 등을 추가(중복은 무시).
- **예시**:
  ```
  $ acommit init --lang en
  [info] Created .acommit/rules.yml (en template)
  [info] Updated .gitignore with .acommit/ entries
  ```

### acommit --help
- **용도**: 모든 명령과 옵션 요약 확인.
- **출력 예시**:
  ```
  Usage: acommit [options] [command]

  AI 기반 맞춤 커밋 메시지 생성기

  Options:
    -V, --verbose        자세한 로그를 출력합니다.
    -v, --version        버전 정보를 출력합니다.
    -h, --help           output usage information

  Commands:
    run [options]        변경분을 수집하고 커밋 메시지를 생성합니다.
    prompt [options]     일회성 혹은 지속 프롬프트를 추가합니다.
    model [options]      acommit 에서 사용할 LLM 제공자를 선택합니다.
    init [options]       .acommit/rules.yml 템플릿을 생성하고 .gitignore 를 갱신합니다.
    help [command]       display help for command
  ```

### 실행 예시
```
[acommit] Processing 5 changed files...
[acommit] Requesting LLM... done.

feat: add CLI progress bar

- add ProgressUI to visualize diff processing
- wire run command to show spinner + counts

[acommit] Result saved at: .acommit/results/2025-11-08_17-59-16.md
```

---

## 3. 설정 파일 `.acommit/rules.yml`

### 기본 예시
```yaml
version: 1

tags:
  enabled: true
  list: [feat, fix, docs, chore, refactor, test, perf, build, ci]
  separator: " "
  style: "{tag}:"

message:
  language: ko
  style: verb          # verb | declarative | imperative | past
  tone: concise        # concise | detailed
  lines: single        # single | multi
  wrap: 72

grouping:
  mode: by-directory   # per-file | by-tag | by-directory | by-similarity | none
  directoryDepth: 1
  threshold: 0.6
  maxGroupSize: 10

diff:
  includeBinary: false
  untrackedSizeLimit: 512000
  context: 3

ignore:
  files:
    - package-lock.json
    - "*.lock"
    - dist/**
  tagsForPaths:
    docs/**: docs
    scripts/**: chore

llm:
  provider: openai     # gemini | openai
  model: gpt-4o        # 미지정 시 환경 변수 참고
  maxPromptTokens: 200000
  maxOutputTokens: 4000

conventional:
  compatible: false
  scope:
    enabled: false
    inferFromPath: true
```

### 주요 항목 정리
- **tags**: 커밋 태그 목록과 출력 형식을 제어합니다. `style` 은 템플릿, `separator` 는 태그와 메시지 사이 구분자입니다.
- **message**: 언어(`language`/`lang`), 어조, 길이 등을 정의합니다.
- **grouping**: diff를 어떻게 묶어 요약할지 결정합니다. `by-similarity` 는 파일 내용 기반 유사도, `by-directory` 는 폴더 단위입니다.
- **diff**: DiffCollector 가 읽는 범위를 제한해 대형 파일로 인한 토큰 초과를 방지합니다.
- **ignore**: 특정 파일/경로를 무시하거나 자동 태그를 지정할 수 있습니다.
- **llm**: `provider` 와 `model` 을 지정합니다. `model` 을 생략하면 `.env` 의 `GEMINI_MODEL` 또는 `OPENAI_MODEL` 을 사용합니다.
- **conventional**: Conventional Commits 호환 옵션입니다. scope 자동 추론 기능을 포함합니다.

템플릿을 변경한 뒤에는 Git에 커밋해두면 팀원이 동일한 규칙을 공유할 수 있습니다.

---

## 4. 환경 변수 및 API 키 가이드

### 1) `.env` 템플릿
`.env.sample` 참고:
```
GEMINI_MODEL=
GEMINI_API_KEY=
OPENAI_MODEL=
OPENAI_API_KEY=
```

### 2) API 키 발급
- **Gemini (Google AI Studio)**  
  1. [Google AI Studio](https://makersuite.google.com/) 접속  
  2. API key 발급 후 `.env` 의 `GEMINI_API_KEY` 에 입력  
  3. 사용할 모델명을 `GEMINI_MODEL` 로 지정 (`gemini-2.5-flash` 등)

- **OpenAI**  
  1. [OpenAI Dashboard](https://platform.openai.com/) → API keys  
  2. `OPENAI_API_KEY` 로 저장  
  3. `OPENAI_MODEL` 은 `gpt-4o`, `gpt-4o-mini` 등 원하는 모델 이름으로 설정

---

## 5. 내부 동작 원리 (간단 요약)

1. **Diff 수집** — `DiffCollector` 가 Git diff를 파일 단위로 읽고 필터링합니다.  
2. **설정 로드** — `loadConfig` 가 `.acommit/rules.yml` 과 기본 스키마(`schema.js`)를 합쳐 유효한 설정 객체를 생성합니다.  
3. **프롬프트 구성** — `buildPromptFromDiff` 가 시스템 메시지/사용자 메시지/보조 프롬프트를 합성하고 토큰 수를 추산합니다.  
4. **LLM 호출** — `createLLMClient` 가 `llm.provider` 에 맞는 모듈(`gemini.js`, `openai.js`)을 로드해 `gen()` 으로 결과를 받아옵니다.  
5. **결과 저장** — 콘솔 출력과 함께 `appendResult` 가 `.acommit/results/<timestamp>.md` 파일을 만들어 히스토리를 남깁니다.  
6. **UI/로그** — `ProgressUI` 와 `logger` 가 진행 상태, 오류, 디버그 정보를 보여줍니다.

---

## 6. 개발 · 테스트 팁

- **개발 실행**: `node bin/acommit.js run` 으로 로컬 버전을 직접 실행할 수 있습니다.
- **테스트**: `npm test` (Jest) 또는 `node test/run-tests.js` 로 LLM 계약 테스트를 수행합니다.
- **디버깅**: `acommit run -V` 로 Verbose 로그를 활성화하면 LLM 요청/응답 요약을 확인할 수 있습니다.

---

## 7. 라이선스

MIT License © 2025 — SeungjoonH.  
출처 표기만 유지하면 누구나 자유롭게 사용·수정·배포할 수 있습니다.
