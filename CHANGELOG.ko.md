# 변경 이력

---

## v0.4.0 — 2026-08-30

### 에이전트 플러그인으로 사용

- **Claude Code / Codex / Cursor 지원** — acommit을 각 도구의 플러그인으로 설치해 `/acommit:commit`(Claude Code), `$commit`(Codex), `/commit`(Cursor) 등 5개 skill(`commit`/`init`/`config`/`infer-rules`/`result`)로 바로 사용
- **에이전트 백엔드** — LLM API 호출 없이 에이전트가 직접 diff를 읽고 그룹핑·커밋 메시지를 판단, 실행 전 규칙 위반 자동 검증
- **API 백엔드** — `acommit commit --headless --json`으로 실제 LLM API를 무인 실행, 에이전트 백엔드와 동일한 결과 형식 유지

### 개인 설정 분리

- **`.acommit/settings.local.yml` 도입** — 자동 실행 여부, push 여부, env 보호 방식 등 개인 실행 설정을 팀 공용 `rules.yml`과 분리해 관리 (gitignore 대상)
- **provider/model 실시간 조회** — Gemini/OpenAI/OpenRouter 모델 목록을 하드코딩 대신 실제 API에서 가져와 최신 상태 유지

### 히스토리 기반 규칙 추천

- **과거 커밋 분석** — 기존 git 로그를 분석해 언어·태그·그룹핑 방식 등 `rules.yml` 초안을 자동으로 제안

### 보안 및 안전성

- **`.env` 커밋 방지** — `.env`, `.env.local`, `.env.prod`, `.env.dev`, `.env.development`, `.env.production` 등 민감한 환경 파일이 커밋 후보에 있으면 diff 본문을 읽기 전에 중단하고 `.gitignore` 보호 규칙 추가 여부를 확인
- **공유용 env 템플릿 허용** — `.env.example`, `.env.sample`, `.env.template`, `.env.production.example` 같은 예시 파일은 커밋 가능하도록 예외 처리
- **`node_modules` hard exclude** — `.gitignore` 설정이 없거나 불완전해도 `node_modules` / `.pnpm` 경로는 diff 수집 단계에서 무조건 제외

### 결과 실행

- **ignored 경로 자동 제외** — 결과 뷰어에서 `git add node_modules src/a.js`처럼 ignored 경로가 섞여 있으면 ignored 경로만 빼고 나머지 파일만 staging
- **ignored-only 커밋 자동 스킵** — 커밋 대상이 `node_modules`처럼 ignored 경로뿐이면 `git commit`을 실행하지 않고 해당 커밋을 건너뜀
- **친절한 Git 에러 메시지** — `.gitignore` 때문에 `git add`가 실패하는 경우 Git 원문 대신 원인과 다음 행동을 설명하는 메시지 표시

### 안정성 개선

- **커밋 텍스트 파싱 순서 수정** — 특정 조건에서 값이 정의되기 전에 참조되던 문제 수정
- **그룹핑 실패 시 복구** — 그룹핑 판단이 유효하지 않은 응답을 반환해도 오류로 중단하는 대신 규칙 기반 초안으로 대체

---

## v0.3.1 — 2026-06-28

### 버그 수정

- **`npm install` 후 `acommit rules` / `acommit result`** — 전역·패키지 설치 환경에서 설정 UI·결과 뷰어가 `ENOENT` 없이 열리도록 수정

### 그룹화

- **`grouping.maxGroupSize` 설정 제거** — 그룹당 파일 수를 따로 맞출 필요 없음 (토큰·출력 한도가 실질 제한)
- **`by-similarity` 그룹 품질 개선** — 비슷한 변경끼리 더 잘 묶이고, `CHANGELOG.en` / `CHANGELOG.ko` 같은 로케일 쌍을 한 커밋으로 묶기 쉬워짐
- **긴 출력 잘림 완화** — 커밋·그룹이 많을 때 메시지가 중간에 잘리던 경우 감소 (`rules.yml`의 `maxOutputTokens`를 끝까지 활용)
- **잘못된 그룹이면 조기 중단** — 파일이 빠지거나 겹치는 등 그룹이 성립하지 않으면, 엉뚱한 커밋 메시지를 내기 전에 오류로 알림

### 커밋 메시지 품질

- **태그 선택** — 코드 분리·추출 시 `refactor`를 더 잘 쓰고, `*.md`는 `docs`로 맞추기 쉬워짐
- **허용 태그만 쓸 때** — `tags.list`에 없는 태그를 경로만 보고 쓰는 경우 감소 (예: `docs`만 허용일 때 `docs/**`도 `feat`/`fix`로)
- **멀티라인(`lines: multi`)** — 본문 bullet과 `git add` / `git commit` 줄 형식이 더 안정적
- **한국어 서술형(`style: declarative`)** — `~함` / `~습니다` 어미를 예시·지침에 맞게 더 잘 따름
- **메시지 내용** — 폴더명·경로(`k8s`, `migrations` 등)만 보고 쓰지 않고, 실제 diff 변경을 반영하도록 개선

### CLI

- **`acommit commit` 진행 표시** — 지금 단계가 diff 수집인지 구분하기 쉽게 문구·라벨 정리 (`diffs`)
- **그룹 요약** — 그룹핑 후 `N개 파일 → M그룹` 한 줄로 표시

---

## v0.3.0 — 2026-06-27

### 결과 뷰어

커밋 생성 결과를 브라우저에서 확인하고 직접 실행할 수 있습니다.

- `acommit result` — 결과 뷰어를 브라우저로 오픈
- `acommit commit` 완료 후 결과 뷰어가 자동으로 열림 (`Ctrl+C`로 종료)
- 좌측 파일 트리로 커밋별 변경 파일 탐색
- 제목 직접 편집, 셸 명령어 복사, `git commit` 즉시 실행
- 태그 스타일 일괄 변경 툴바

### 다국어 지원

CLI 출력과 뷰어 UI 언어를 통일해서 설정할 수 있습니다.

- `acommit locale ko` / `acommit locale en` — 언어 설정
- 인수 없이 실행하면 대화형 선택기 실행
- 설정은 `.acommit/locale`에 저장됨

### OpenRouter 지원

OpenRouter를 통해 수백 개의 모델을 하나의 API 키로 사용할 수 있습니다.

- `acommit model -p openrouter` 로 선택
- `rules.yml`에서 `llm.provider: openrouter`로 설정 가능
- OpenRouter API 키는 `OPENROUTER_API_KEY` 환경 변수에 저장

### 기타 개선

- **태그 기본값 변경** — `tags.style` 기본값 `"{tag}"`, `tags.separator` 기본값 `": "` (예: `feat: 메시지`)
- **스피너 안정성** — Cursor 등 비표준 터미널에서 스피너가 여러 줄로 깨지던 문제 수정
- **모델 정보 표시** — 스피너마다 반복되던 모델 이름이 시작 시 한 번만 출력되도록 변경
- **`git add` 경로 이스케이프** — 파일 경로에 `[`, `]`, `(`, `)` 가 있을 때 자동으로 이스케이프 처리

---

## v0.2.0 — 2026-02-13

### 멀티 프로바이더 LLM

- Gemini, OpenAI 중 선택 가능 — `acommit model`로 전환
- `rules.yml`의 `llm.provider` / `llm.model` 필드로 고정 설정 가능

### 프롬프트 시스템

- `acommit prompt` — 이번 실행에만 적용되는 일회성 지침 추가
- `acommit prompt --save` — `.acommit/rules.yml`에 영구 저장

### 안정성 및 개발 경험

- `rules.yml` 일부 필드만 작성해도 나머지는 기본값으로 자동 채워짐
- API 키 등 민감 정보가 verbose 로그에 출력되지 않도록 자동 마스킹
- LLM 요청 내역이 `.acommit/results/prompts/`에 자동 기록

### Breaking

- 명령어 이름 변경: `acommit run` → `acommit commit`

---

## v0.1.0 — 2025-11-08

최초 릴리즈.

- `acommit commit` — `git diff` 분석 후 Gemini로 커밋 메시지 자동 생성
- `acommit init` — `.acommit/rules.yml` 생성 및 `.gitignore` 업데이트
- `rules.yml` 설정: 태그, 메시지 스타일, 그룹화, diff 처리, ignore 패턴, conventional commits
- staged / unstaged / untracked 파일 모두 처리
- 파일별, 태그별, 디렉터리별, 유사도 기반 등 4가지 그룹화 전략
- 토큰 예산 관리 및 diff 자동 트런케이션
