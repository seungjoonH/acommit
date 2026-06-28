# 변경 이력

---

## v0.3.1 — 2026-06-28

### 버그 수정

- **`acommit rules` / `acommit result` (npm 설치)** — 배포 패키지에 `web/src`가 없어도 미리 빌드된 `dist/web`으로 UI가 정상 실행되도록 수정 (이전 버전은 `ENOENT`로 실패)

### 그룹화

- **`grouping.maxGroupSize` 제거** — 커밋 그룹당 파일 수 인위 제한 없음; 토큰/출력 예산이 실질 한도
- **Plan 자동 보정** — LLM 계획의 누락·중복·알 수 없는 경로를 휴리스틱 초안 기준으로 보정 (재요청 없음)
- **출력 토큰 상한** — 그룹별 생성 시 `llm.maxOutputTokens` 전체 사용 (숨겨진 800 토큰 상한 제거)
- **Plan → Generate 파이프라인** — `by-similarity`는 LLM **계획** 1회(의도 기반 그룹 JSON) 후 그룹마다 **생성** 1회; 구조 모드(`per-file`, `by-directory`, `by-tag`)는 규칙만으로 계획(LLM 추가 호출 없음)
- **계획 검증** — 모든 파일이 정확히 한 그룹에만 포함, 경로 태그 충돌, (eval) `expectedGroups` 오라클 실패 시 커밋 메시지 생성 전에 중단
- **휴리스틱 초안** — 경로 유사도 클러스터링은 `by-similarity`에서 LLM 계획 단계의 힌트로만 사용되며 최종 분할이 아님

### 프롬프트 품질

- **태그 휴리스틱 강화** — 코드 추출(extract) 시나리오에서 `refactor` 태그 우선 규칙 명시, 허용 태그 목록 기준으로 힌트 필터링
- **`*.md`** — 기본 `tagsForPaths`에서 모든 마크다운을 `docs`로; 그룹별 `REQUIRED TAG` 힌트
- **그룹화 지침 보강** — `by-directory`, `by-similarity`, `per-file` 모드별 금지·권장 패턴 추가
- **`lines=multi`** — per-group 프롬프트에 `git commit -m` 멀티라인 예시 반영

### CLI UX

- **`acommit commit`** — 진행 표시를 diff 수집 단계임이 드러나도록 문구 변경, 그룹핑 후 `N개 파일 → M그룹` 요약 출력
- **진행 바** — 라벨 `progress` → `diffs` (파일별 diff 수집임을 구분)

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
