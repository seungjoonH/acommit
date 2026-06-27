# acommit — AI 기반 커밋 자동화 CLI

Git diff 분석 결과를 바탕으로 commit 메시지를 **일관된 형태**로 생성하는 협업 도구입니다.

## 1. 설치 방법

### 1) 설치

```bash
git clone https://github.com/seungjoonH/acommit.git
cd acommit
npm install
npm link            # acommit을 전역에 등록
```

### 2) 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다.

#### GEMINI 사용 시

```
GEMINI_MODEL=your_gemini_model
GEMINI_API_KEY=your_gemini_api_key
```

#### OPENAI 사용 시

```
OPENAI_MODEL=your_openai_model
OPENAI_API_KEY=your_openai_api_key
```

> [!WARNING]
> 
> `API_KEY` 노출을 방지하기 위해 꼭 `.env` 를 `.gitignore` 에 추가하세요!

### 3) 규칙 파일 생성

```bash
acommit init          # 템플릿으로부터 .acommit/rules.yml 생성
```

### 4) 실행

```bash
acommit commit
```

결과는 `.acommit/results/commits/` 에 저장됩니다.

### 5) 규칙 편집 UI (선택)

```bash
acommit rules         # 브라우저에서 .acommit/rules.yml 편집
```


## 저장소 구성

| 영역 | GitHub | npm | 설명 |
| --- | :---: | :---: | --- |
| `bin/`, `src/`, `samples/` | O | O | 사용자 CLI (`commit`, `init`, `model`, `prompt`, `rules`) |
| `web/` | O | X | Rules UI 소스 (Vite). npm에는 `dist/web/` 빌드 결과만 포함 |
| `dist/web/` | X | O | Rules UI 빌드 산출물 (`prepublishOnly`에서 생성) |
| `__tests__/`, `test/` | O | X | 배포 코드용 테스트 |
| `eval/`, `experiments/`, `docs/` | X | X | **로컬 실험 전용** — gitignore, GitHub·npm 모두 제외 |


## 2. 사용 가능한 명령어

| 명령어 | 설명 | 예시 |
| --- | --- | --- |
| `acommit commit` | 현재 변경사항 (git diff) 를 토대로 commit 요약 초안을 작성합니다. | `acommit commit` |
| `acommit prompt [--save]` | 보조 프롬프트(일회성 또는 영구적)를 추가합니다. | `acommit prompt -m "Highlight refactoring"` |
| `acommit model` | 사용할 LLM 백엔드를 선택합니다. | `acommit model -p gemini` |
| `acommit init` | `.acommit/rules.yml`을 생성하고 `.gitignore`를 업데이트합니다. | `acommit init --lang en` |
| `acommit rules` | 브라우저에서 `.acommit/rules.yml`을 편집하는 UI를 엽니다. | `acommit rules` |
| `acommit --help` | 전역 옵션과 함께 CLI 도움말을 표시합니다. | `acommit --help` |

### `acommit commit`

```sh
acommit commit
```

현재 변경사항 (`git diff`)을 분석하여 **커밋 요약 초안**을 작성합니다.


### `acommit prompt`

```sh
acommit prompt [options]
```

LLM에 **추가 지침**을 제공하여 생성 결과에 반영합니다. 지침은 **일회성**으로 사용하거나 **영구적**으로 저장할 수 있습니다.

#### 옵션

| 옵션 | 설명 | 유형 |
| :--- | :--- | :--- |
| `-m, --message <msg>` | 인라인 텍스트로 **프롬프트 메시지**를 제공합니다. (에디터 실행 건너뛰기) | optional |
| `--save` | 프롬프트를 `.acommit/rules.yml`에 **영구적으로 저장**합니다. | optional |

#### 흐름

1.  기본적으로 `vi` 가 실행되어 지침을 작성할 수 있습니다.
2.  `--save` 옵션이 없으면 다음 실행에 대해서만 임시로 저장됩니다.
3.  `--save` 옵션이 있으면 반복 사용을 위해 설정 파일에 추가됩니다.


### `acommit model`

```sh
acommit model [options]
```

초안 생성에 사용할 **LLM 백엔드**(`Gemini` 또는 `OpenAI`)를 선택합니다.

#### 옵션

| 옵션 | 설명 | 유형 |
| :--- | :--- | :--- |
| `-p, --provider <name>` | 사용할 LLM 제공자 (`gemini` 또는 `openai`)를 직접 선택합니다. | optional |

#### 흐름

1.  현재 설정된 LLM 제공자를 읽습니다.
2.  새 선택 항목으로 덮어씁니다. (옵션 미지정 시 대화형 선택기 사용)
3.  필요한 **환경 변수** 설정에 대한 알림을 출력합니다.


### `acommit init`

```sh
acommit init [options]
```

`acommit` 설정을 위한 기본 파일인 `.acommit/rules.yml`을 생성하고, 생성된 파일이 커밋되지 않도록 `.gitignore` 파일을 업데이트합니다.

#### 옵션

| 옵션 | 설명 | 유형 |
| :--- | :--- | :--- |
| `--lang <code>` | `.acommit/rules.yml` 템플릿의 언어 코드를 지정합니다. (`ko` 또는 `en`, 기본값 `ko`) | optional |

#### 흐름

1.  `rules.yml`이 없으면 템플릿을 복사하여 생성합니다.
2.  `.gitignore`에 `.acommit/` 항목이 없으면 추가합니다.


### `acommit --help`

```sh
acommit --help
```

`acommit` CLI의 **전역 옵션과 사용 가능한 명령어 목록**을 표시합니다.


## `.acommit/rules.yml` 설정 가이드

`.acommit/rules.yml` 파일은 `acommit` CLI의 **동작 방식**과 **생성되는 커밋 메시지의 스타일**을 정의하는 핵심 설정 파일입니다. 팀의 **커밋 컨벤션**과 **LLM 사용 환경**에 맞게 각 설정을 조정할 수 있습니다.


### 1. `tags` (커밋 태그 설정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `enabled` | 태그(`feat`, `fix` 등) 사용 여부 | `boolean` | `true` |
| `list` | 사용 가능한 태그 목록 (컨벤션 합의 필요) | `array` | `[feat, fix, docs, ...]` |
| `style` | 태그 출력 형식 템플릿 | `string` | `"{tag}:"` |
| `separator` | 태그와 본문 사이의 구분자 | `string` | `" "` |

> **`style` 플레이스홀더**:
> * `{tag}`: 소문자 (`feat`)
> * `{TAG}`: 대문자 (`FEAT`)
> * `{Tag}`: 첫 글자 대문자 (`Feat`)
> * `{scope}`: `conventional.scope.enabled`가 `true`일 때 스코프 값
> * `{sep}`: `separator` 값


### 2. `message` (메시지 본문 설정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `language` | 생성할 메시지의 언어 | `string` | `"ko"` (`ko` \| `en`) |
| `style` | 문장 스타일 | `string` | `"verb"` (`verb` \| `declarative` \| `imperative` \| `past`) |
| `tone` | 메시지의 간결함 정도 | `string` | `"concise"` (`concise` \| `detailed`) |
| `lines` | 메시지의 줄 수 | `string` | `"single"` (`single` \| `multi`) |
| `wrap` | 제목 줄 길이 가이드라인 (자동 줄바꿈은 아님) | `integer` | `72` |

#### `message.emoji` (이모지 설정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `enabled` | 태그별 이모지 사용 여부 | `boolean` | `false` |
| `map` | 태그와 이모지 매핑 (`feat: "✨"`, `fix: "🐛"`) | `map` | `{ feat: "✨", ... }` |


### 3. `grouping` (커밋 분리/병합 로직)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `mode` | 파일 묶음 방식 | `string` | `"by-similarity"` |
| `directoryDepth` | `by-directory` 모드에서 사용할 디렉터리 깊이 | `integer` | `1` |
| `minFilesPerGroup` | 이 미만 파일 수의 그룹은 `per-file`로 대체됨 | `integer` | `2` |
| `threshold` | `by-similarity` 모드의 유사도 기준 (0~1, 높을수록 엄격) | `float` | `0.60` |
| `maxGroupSize` | 한 그룹에 포함될 수 있는 최대 파일 수 | `integer` | `10` |

> **`mode` 옵션**:
> * `per-file`: 파일별 1 커밋
> * `by-tag`: 태그(feat/fix/docs/...)별로 묶음
> * `by-directory`: 디렉터리 경로 기반으로 묶음
> * `by-similarity`: 변경 내용/경로/토큰 유사도 기반으로 묶음
> * `none`: 묶지 않음 (메시지만 생성)


### 4. `diff` (Diff 처리 설정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `includeBinary` | 바이너리 파일 내용을 Diff에 포함할지 여부 | `boolean` | `false` |
| `untrackedSizeLimit` | 신규 파일 본문의 최대 바이트 크기 (초과 시 잘라냄) | `integer` | `512000` |


### 5. `ignore` (무시/태그 강제 지정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `files` | 커밋 메시지 생성에서 제외할 경로 패턴 (글롭) | `array` | `[package-lock.json, *.lock, ...]` |
| `tagsForPaths` | 특정 경로 패턴에 대해 기본 태그를 강제 지정 | `map` | `{ "docs/**": "docs", "scripts/**": "chore" }` |


### 6. `llm` (대규모 언어 모델 설정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `provider` | 사용할 LLM 서비스 제공자 | `string` | `"gemini"` (`gemini` \| `openai`) |
| `model` | 사용할 모델 이름 (미지정 시 환경 변수 사용) | `string` | `gpt-4o` |
| `maxPromptTokens` | 프롬프트 토큰의 상한선 (안전 장치) | `integer` | `200000` |
| `maxOutputTokens` | 출력 토큰의 상한선 (안전 장치) | `integer` | `4000` |


### 7. `conventional` (Conventional Commits 설정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `compatible` | Conventional Commits 규격 준수 여부 | `boolean` | `false` |

#### `conventional.scope` (스코프 설정)

| 키 | 설명 | 유형 | 기본값 (예시) |
| :--- | :--- | :--- | :--- |
| `enabled` | 스코프 (`(helper)`, `(api)`) 출력 사용 여부 | `boolean` | `false` |
| `inferFromPath` | 파일 경로에서 스코프를 자동 추론할지 여부 | `boolean` | `true` |

> **예시**: `compatible: true`, `scope.enabled: true`, `tags.style: "{tag}({scope}):"`로 설정 시,
> 결과는 `"feat(helper): 메시지"` 와 같이 생성될 수 있습니다.

> [!TIP]
> 템플릿을 편집한 후 커밋하여 팀원들이 동일한 규칙을 상속하도록 할 수 있습니다.


## 4. 환경 변수 및 API 키

### 1) `.env` 템플릿

`.env.sample` 참조

```
GEMINI_MODEL=
GEMINI_API_KEY=
OPENAI_MODEL=
OPENAI_API_KEY=
```

### 2) API 키

  - **Gemini (Google AI Studio)**

    1.  [Google AI Studio](https://makersuite.google.com/)를 방문합니다.
    2.  API 키를 생성하고 `GEMINI_API_KEY`에 저장합니다.
    3.  `GEMINI_MODEL`을 설정합니다 (예: `gemini-2.5-flash`).

  - **OpenAI**

    1.  [OpenAI Dashboard](https://platform.openai.com/)를 방문합니다.
    2.  키를 `OPENAI_API_KEY`에 저장합니다.
    3.  `OPENAI_MODEL`을 선택합니다 (예: `gpt-4o`, `gpt-4o-mini`).


## 5. 라이선스

MIT 라이선스 © 2025 — SeungjoonH.
출처가 보존되는 한 자유롭게 사용, 수정 및 배포할 수 있습니다.


## 6. 오픈소스 협업

이 프로젝트는 오픈소스로 운영되며, 누구나 자유롭게 참여할 수 있습니다.  
버그 수정, 기능 제안, 문서 개선, 코드 리팩토링 등 모든 형태의 **Pull Request** 를 환영합니다.