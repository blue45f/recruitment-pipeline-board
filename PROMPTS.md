# PROMPTS

기능 구현 판단에 사용한 프롬프트와 검증 결과를 커밋 순서대로 정리합니다. 공개 저장소에 필요하지 않은 로컬 경로와 실행 제어 문구는 제외했습니다.

## 프로젝트 기반 구성

### 프롬프트 1

> React 19와 Vite, TypeScript, React Compiler를 기반으로 프로젝트를 구성해줘. React Router, TanStack Query, Zustand, Ky, Zod, React Hook Form, react-error-boundary, Radix UI, Tailwind CSS, TanStack Virtual을 설치하고 기본 provider와 router를 연결해줘. MSW, Vitest, Testing Library, Cypress, Storybook, jsx-a11y, Prettier, ESLint, Husky, lint-staged, Commitlint, Secretlint, Knip도 추가해서 정적 검사, 단위 테스트, production build, Storybook build, Cypress smoke test를 실행할 수 있게 해줘. 아직 채용 보드 기능은 구현하지 말고 접근 가능한 기반 화면까지만 만들어줘.

### 프롬프트 2

> 폴더 구조는 `features` 계층을 사용하지 말고, 채용 도메인에서 함께 변경되는 모델, API, 보드, 단계 이동, Undo 코드를 `src/domains/recruitment` 아래에 모아줘. `app`은 provider와 router 조립, `routes`는 URL 진입점만 담당하고 두 영역 이상에서 재사용되는 UI와 인프라만 `src/components/ui`와 `src/lib`로 올려줘. 도메인 내부 구현은 전역 `types`, `hooks`, `utils` 폴더로 흩뜨리지 말고 가까이 배치하며, 공개 API가 필요한 경계에만 `index.ts`를 둬. 이 의존 방향이 ESLint alias와 TypeScript path 설정에서도 지켜지는지 확인해줘.

### 프롬프트 3

> Commitlint를 반드시 포함해줘. `@commitlint/cli`, `@commitlint/config-conventional`, `commitlint.config.js`와 Husky `commit-msg` 훅을 연결하고 첫 커밋 메시지를 실제로 검증할 수 있게 해줘. `pre-commit`에서는 lint-staged만 실행해줘.

### 프롬프트 4

> 로컬 SonarQube도 연동해도 좋을 것 같아.

### 프롬프트 5

> 도전 요구사항, 특히 웹 접근성을 잘 챙겨줘.

### AI 출력 요지

- provider와 router를 조립하는 `app`, URL 진입점인 `routes`, 채용 코드를 모으는 `domains/recruitment`, 공용 UI와 인프라를 담는 `components`와 `lib`로 경계를 나눴다.
- React Compiler와 MSW를 Vite 실행 흐름에 연결하고 타입 검사부터 Storybook과 Cypress까지 한 번에 확인할 수 있는 품질 도구를 구성했다.
- Husky의 `pre-commit`과 `commit-msg` 훅을 분리해 staged 파일 검사와 커밋 메시지 검증을 각각 맡겼다.
- SonarQube Community Build는 Docker Compose로 따로 실행하고 NPM scanner가 Vitest의 LCOV 결과를 읽도록 연결했다.
- `eslint-plugin-jsx-a11y`, Cypress axe, AccessLint를 각기 다른 단계에 두고 정적 규칙과 실제 렌더 결과를 함께 확인하게 했다.

### 리뷰 / 검증

- 초기 의존성 조합에서 ESLint 10과 `eslint-plugin-jsx-a11y`, TypeScript 6과 Storybook 도구의 peer 범위가 맞지 않는 점을 설치 로그로 확인했다. 최신 버전을 무조건 유지하는 대신 ESLint 9.39.5와 TypeScript 5.9.3으로 조정했고 `pnpm peers check`에서 충돌이 없음을 확인했다.
- Storybook용 MSW 설정에서 이전 API를 사용한 초안은 실제 export와 맞지 않았다. `msw-storybook-addon` 3.x의 `mswLoader()` 방식으로 수정한 뒤 Storybook production build를 다시 통과시켰다.
- 버튼의 동적 `type` 값이 접근성 린트 규칙에 걸려 `button | submit`으로 범위를 좁혔다. 의도하지 않은 폼 제출을 막으면서 ESLint와 타입 검사를 함께 통과했다.
- `pnpm check`로 포맷, ESLint와 접근성 규칙, Secretlint, Knip, 타입, production build, Vitest 3개, Storybook build를 확인했다. Cypress Electron smoke test 1개와 axe 검사도 통과했다.
- scope와 한글 요약, `변경`, `이유`, `AI 검토` 본문이 빠진 메시지는 Commitlint가 거부했다. 같은 항목을 모두 포함한 첫 커밋 메시지는 통과했다.
- 구조 리뷰에서 alias import만 막으면 상대 경로로 계층 제한을 우회할 수 있다는 문제를 발견했다. 파일의 실제 위치를 판별하는 `eslint-plugin-boundaries`와 TypeScript resolver를 적용했고 `domains → app`, `lib → domains`의 상대 경로와 alias 경로가 모두 거부되는지 stdin probe로 확인했다.
- 초기화 Promise가 reject되면 React Error Boundary가 만들어지기 전이라 복구할 수 없다는 지적을 채택했다. root를 먼저 만든 뒤 초기화 실패 전용 화면을 렌더하도록 바꾸고 mock worker 시작이 reject되는 조건과 재시도 동작을 단위 테스트했다.
- SonarQube Compose 문법, scanner 5.0.0 실행, LCOV 파일 생성은 확인했다. 현재 검증 환경에서는 4GB Docker 메모리를 다른 컨테이너와 공유해 Elasticsearch가 OOM 종료됐으므로 서버 분석 성공으로 기록하지 않았다.
- AccessLint는 첫 화면의 `main` 렌더를 기다린 뒤 WCAG 2.2 자동 규칙 94개를 실행했고 위반 0건을 확인했다. 실제 보조기기에서 안내 품질이 어떤지는 이 결과로 단정하지 않고 후속 수동 검증 대상으로 남겼다.

## [candidate-contracts] 후보자 데이터 계약

### 프롬프트 1

> 채용 파이프라인의 5단계는 `서류검토 → 면접 → 처우협의 → 최종합격 / 불합격`으로 고정해줘. 후보자 카드와 상세 화면, Mock API가 함께 사용할 후보자 ID·이름·직무·지원일·현재 단계·이메일·경력·메모 계약을 Zod로 정의하고 TypeScript 타입은 스키마에서 추론해줘. 목록/단건/단계 변경 요청·응답 스키마도 도메인 가까이에 두고, 잘못된 날짜·이메일·단계·빈 문자열을 거부하는 계약 테스트를 작성해줘. 200명과 1,000명 성능 시나리오를 재현할 수 있도록 seed를 받는 결정적 후보자 생성기를 만들되 `Math.random`, 현재 시각, 네트워크나 UI에는 의존하지 않게 해줘. 공개 API가 필요한 경계에만 `index.ts`를 두고 아직 API handler나 화면은 구현하지 마.

### AI 출력 요지

- 다섯 단계와 여섯 직무를 값과 한글 라벨로 분리하고, 후보자·목록·상세·단계 변경 계약을 strict Zod 스키마로 정의했다.
- 빠른 연속 이동을 다음 기능에서 검증할 수 있도록 후보자에 `revision`, 단계 변경 요청에 `expectedRevision`과 `clientMutationId`를 포함했다.
- 고정된 기준 시각과 seed 난수 생성기를 사용해 빈 목록, 200명, 1,000명 데이터를 같은 입력에서 항상 똑같이 만들도록 했다.

### 리뷰 / 검증

- 과제 원문을 다시 확인해 단계명과 순서를 `서류검토·면접·처우협의·최종합격·불합격`으로 맞췄다. UI에서 쓸 한글 라벨과 API에서 쓸 안정적인 영문 값을 따로 둔 방식은 그대로 채택했다.
- 초안에 추가된 revision 계약은 필수 카드 정보는 아니지만 경쟁 상태를 감지하는 데 필요하다고 판단해 유지했다. 반면 이 커밋에서는 저장 동작이나 화면을 함께 만들지 않아 기능 경계를 지켰다.
- 잘못된 ISO 날짜와 이메일, 알 수 없는 단계, 공백 이름, 지원일보다 이른 단계 변경일, 목록 개수 불일치를 실제 스키마 파싱 실패로 확인했다.
- `Math.random`과 `Date.now`가 호출되면 실패하는 테스트를 추가하고, 같은 seed의 200명 결과가 일치하며 1,000명의 ID와 이메일이 중복되지 않는지 확인했다. 내부 난수 상태가 32비트라는 점을 놓치면 서로 다른 큰 seed가 같은 결과를 만들 수 있어 입력 범위를 `0`부터 `0xffffffff`까지로 제한했다. 전용 Vitest 20개가 통과했다.
- 첫 Knip 실행은 아직 소비자가 없는 공개 계약을 미사용 export로 판단했고, Zod도 이전의 준비 단계 예외에 남아 있었다. 도메인 `index.ts`를 공개 진입점으로 선언하고 Zod 예외를 제거해 실제 미사용 의존성 검사를 다시 통과시켰다.

## [mock-api] 지연·실패·영속화를 포함한 후보자 API

### 프롬프트 1

> 후보자 목록·상세·단계 변경 Mock API를 설계해줘. 모든 endpoint에 200~800ms 지연과 약 15% 실패를 적용하고, localStorage에 단계 변경을 저장해 새로고침 뒤에도 유지해야 해. `expectedRevision`으로 같은 후보자의 빠른 연속 요청을 보호하되, 테스트에서는 지연·실패·시각·request ID를 주입해 결정적으로 재현할 수 있어야 해. MSW의 브라우저와 Node 환경이 같은 도메인 로직을 안전하게 쓰는 구조, 저장 실패 시 무변경 보장, 400·404·409·503 테스트 관점을 먼저 검토해줘. 아직 Ky 클라이언트와 UI는 포함하지 마.

### 프롬프트 2

> `GET /api/candidates?size=0|200|1000`, `GET /api/candidates/:id`, `PATCH /api/candidates/:id/stage`를 MSW 2로 구현해줘. 초기 원본은 고정 seed의 1,000명으로 유지하고 조회 크기는 응답만 잘라야 하며, 단계 변경 overlay는 버전이 있는 localStorage envelope에 저장해줘. URL 문자열과 body는 기존 Zod 계약으로 엄격히 검증하고 구조화된 오류를 반환해줘. PATCH는 인위적 지연 뒤 최신 revision을 다시 읽어 await 없는 CAS로 처리하고, storage write가 성공한 다음에만 변경을 확정해줘. handler factory에는 storage, latency, failure, clock, request ID를 주입할 수 있게 하고 Node 테스트에서 절대 URL 요청도 가로채도록 해줘.

### AI 출력 요지

- 고정된 1,000명 원본에 단계·변경일·revision만 overlay로 저장하는 repository와 memory/localStorage adapter를 분리했다.
- 목록·상세·단계 변경 handler를 factory로 만들고 기본 지연과 실패 확률은 유지하면서 테스트에서는 각 효과를 주입할 수 있게 했다.
- 동일 revision의 요청은 지연이 끝난 뒤 저장소를 다시 읽고 동기적으로 비교·저장해 한 요청만 성공하도록 했다.

### 리뷰 / 검증

- `URLSearchParams`가 항상 문자열을 반환한다는 점을 반영해 `0`, `200`, `1000`만 명시적으로 숫자 계약에 매핑했다. 누락, 중복, `0200`, `200.0` 요청이 400인지 확인했다.
- 지연 전에 후보자를 읽는 초안은 두 PATCH가 같은 revision을 보고 모두 성공할 수 있어 기각했다. 두 요청을 같은 gate에서 해제한 통합 테스트에서 응답이 정확히 200 하나와 409 하나이고 revision이 한 번만 증가하는지 확인했다.
- 200명과 1,000명 조회마다 원본을 다시 만들면 이전 변경이 사라질 수 있어 단일 1,000명 원본과 overlay 방식을 채택했다. `size=0` 조회 뒤 새 repository를 만들어도 변경이 유지되는지 검증했다.
- localStorage write가 실패할 때 캐시를 먼저 바꾸지 않도록 repository를 무상태로 유지했다. 강제 503과 storage write 오류 뒤 단계와 revision이 그대로인지 확인했다.
- 첫 구현은 storage read 예외와 형식만 유효한 잘못된 overlay가 목록 요청을 깨뜨릴 수 있었다. read 오류는 구조화된 503으로 바꾸고 후보자 계약까지 통과하지 못한 overlay는 무시하도록 보완했다.
- Node MSW에서 `*/api/...` 패턴으로 절대 URL을 호출했고 전용 통합 테스트 20개가 통과했다. 별도 jsdom 테스트 2개로 새 adapter에서도 localStorage 값이 유지되고 제거되는지 확인했다.
- 실제 Vite 페이지의 격리된 브라우저 탭에서도 목록 요청이 251ms 뒤 MSW 응답을 받는지 확인했다. 첫 후보자를 PATCH한 뒤 페이지를 새로고침하고 상세 API를 다시 호출해 변경 단계와 증가한 revision이 localStorage에서 복원되는 것을 확인했다.

## [api-client] Ky·Zod 응답 경계와 오류 정규화

### 프롬프트 1

> Ky로 받은 응답은 바로 도메인 모델로 사용하지 말고 Zod 스키마로 검증해줘. HTTP 상태 오류, 네트워크 단절, timeout, 응답 스키마 불일치를 하나의 구조화된 오류 타입으로 정규화하되 status, request ID, 재시도 가능 여부, 사용자에게 보여 줄 안전한 메시지를 구분해줘. 원본 서버 메시지나 내부 정보는 UI에 직접 노출하지 말고, TanStack Query와 Error Boundary가 같은 오류 계약으로 재시도와 복구를 처리할 수 있게 단위 테스트를 작성해줘. Ky 자체 재시도는 끄고 mutation의 timeout이나 network 오류는 처리 결과가 불명확하므로 자동 재시도 대상으로 표시하지 마. Query 취소에 사용한 AbortError는 일반 네트워크 오류로 바꾸지 마.

### AI 출력 요지

- 후보자 도메인 안에 Ky client와 목록·상세·단계 변경 API를 두고, 성공 JSON을 `unknown`으로 읽은 뒤 기존 Zod 응답 스키마로 검증했다.
- `ApiError` 하나에 오류 종류, HTTP status, 응답 헤더 request ID, 재시도 가능 여부, 안전한 사용자 문구를 담고 원본 오류는 `cause`로만 보존했다.
- 읽기 요청의 408·429·5xx·network·timeout만 후속 Query 재시도 후보로 표시하고 mutation과 schema 오류는 재시도하지 않게 했다.

### 리뷰 / 검증

- 초안은 이전 Ky API 이름인 `prefixUrl`을 사용해 TypeScript가 거부했다. 설치된 Ky 2.0.2 선언과 공식 타입 예시를 확인해 `prefix` 옵션으로 바로잡았다.
- Ky 2는 HTTP 오류 본문을 이미 `HTTPError.data`에 저장하고 원본 response body를 소비한다. `response.json()`을 다시 호출하는 방식을 기각하고 status와 `x-request-id` 헤더만 신뢰하며, 서버 본문의 message는 안전 문구에 사용하지 않았다.
- 네트워크 전송을 기다리는 좁은 catch에서만 raw `TypeError`를 network로 분류했다. 성공 뒤 JSON 파싱 오류와 Zod 불일치는 별도 schema 오류로 처리해 프로그래밍·계약 오류가 재시도되지 않게 했다.
- mutation timeout과 network 오류는 서버가 이미 반영했는지 알 수 없고 현재 `clientMutationId`가 멱등 키로 저장되지는 않으므로 `retryable: false`를 유지했다. Query timeout은 재시도 후보로 구분했다.
- AbortSignal 취소가 `ApiError`로 감싸지지 않는지, Ky가 503을 자체 재시도하지 않는지, 409의 서버 원문이 `message`와 `safeMessage`에 섞이지 않는지 확인했다.
- 유효한 목록·상세·단계 변경, strict schema 불일치, 깨진 JSON, 409·503, network, query/mutation timeout, Abort, 잘못된 로컬 요청과 request ID 정제를 포함한 전용 Vitest 13개를 작성했다.
- 첫 커밋 제목의 `Ky·Zod` 대문자 시작은 Commitlint의 subject-case 규칙이 거부했다. 커밋은 생성되지 않았고 기술명만 소문자로 고쳐 같은 변경을 다시 검증했다.

## [review-fix] SonarCloud 보안·가독성 지적 보완

### 프롬프트 1

> PR #2의 SonarCloud Quality Gate가 새 코드 보안 등급 C로 실패했어. annotation 3건을 실제 line 기준으로 확인해서 수정해줘. Mock API의 지연과 실패 확률에 쓴 `Math.random()` 두 곳은 보안 값이 아니더라도 경고를 숨기지 말고 Web Crypto 기반 난수로 바꾸되, 테스트의 주입 가능한 latency와 failure 구조는 유지해줘. fixture seed의 숫자 구분자 가독성 경고도 의미가 바뀌지 않게 정리하고 전체 테스트와 재분석으로 확인해줘.

### AI 출력 요지

- 기본 지연과 실패 판정에 사용할 0 이상 1 미만 값을 `crypto.getRandomValues()`로 만들고 기존 순수 변환 함수와 테스트 주입 경계는 유지했다.
- 날짜처럼 보이던 fixture seed의 불규칙 숫자 구분자를 제거하고 저장 envelope 테스트 값도 맞췄다.

### 리뷰 / 검증

- GitHub check 요약만 보고 추측하지 않고 SonarCloud check-run annotation API에서 파일과 line을 확인했다. 보안 경고 2건은 `createCandidateHandlers.ts`의 `Math.random`, 가독성 경고 1건은 repository seed였다.
- `NOSONAR`로 숨기는 방식은 기각했다. Mock 확률 자체는 보안 값이 아니지만 Web Crypto로 교체하는 비용이 작고 Quality Gate의 의도를 해치지 않는다고 판단했다.
- 외부에서 latency와 failure를 주입하는 테스트 API는 바꾸지 않아 기존 동시성·실패 회귀 테스트를 그대로 다시 실행할 수 있게 했다.

## [design-system] 채용 운영 화면의 공용 UI

### 프롬프트 1

> Radix UI와 Tailwind CSS로 채용 보드에서 반복해서 쓸 공용 UI를 만들어줘. 버튼, 상태 배지, 텍스트 입력, 직무 선택, 상세 모달, 툴팁, 로딩 딤 처리를 포함하고 기존 버튼 사용처는 깨뜨리지 마. 화면은 밝은 회청색 바탕과 흰 패널, 짙은 남색 본문, 코발트 주요 동작을 기준으로 정리하고 코랄은 시선을 잡는 작은 장식에만 사용해줘. 외부 웹 폰트 요청 없이 본문·제목·숫자 정보의 위계를 나누고 작은 화면에서도 내용이 잘리지 않게 해줘. 아직 후보자 보드의 데이터 조회나 단계 이동은 연결하지 마.

### 프롬프트 2

> 공용 UI의 키보드와 화면 읽기 도구 사용성을 검토해줘. 모달은 이름과 설명, Escape 닫기, 포커스 복귀와 작은 화면 내부 스크롤을 보장하고 Select는 보이는 레이블·도움말·오류를 실제 ARIA 관계로 연결해줘. 로딩 딤은 상태만 보이는 것이 아니라 뒤쪽 입력과 포커스도 막고 `aria-busy`를 알려야 해. 버튼은 로딩 중 접근 가능한 이름과 크기를 유지하고 중복 실행을 차단해줘. 의미 있는 컨트롤 경계와 텍스트 대비, 44px 목표 크기, 동작 감소 설정을 테스트로 고정해줘.

### AI 출력 요지

- 회청색 바탕, 흰 패널, 남색 본문과 코발트 동작 색을 토큰으로 정의하고 기존 색 변수에는 호환 alias를 남겼다.
- Radix의 focus 관리와 포털 동작을 감싸는 얇은 공용 컴포넌트를 만들고, 입력 설명·오류와 로딩 상태처럼 사용처마다 빠뜨리기 쉬운 접근성 계약을 API 안에 포함했다.
- 초기 화면을 둥근 카드와 장식적 배경 중심에서 문서 색인 형태의 운영 화면으로 바꿔 이후 단계 열과 후보자 번호 체계를 자연스럽게 이어갈 수 있게 했다.

### 리뷰 / 검증

- 색 대비 검토에서 코랄과 흰색 조합은 일반 크기 텍스트에 부족하다고 판단해 장식에만 제한했다. 주요 동작의 코발트와 성공 상태 색은 흰색 본문과 AA 대비를 확보하고, 입력과 버튼의 의미 있는 경계에는 일반 구분선보다 진한 토큰을 사용했다.
- 모달 닫기 버튼이 아이콘만 있으면 이름과 목표 크기가 빠지기 쉬워 기본 `닫기` 레이블과 44px 크기를 컴포넌트에서 보장했다. Radix의 focus trap과 Escape 동작은 별도 키 처리로 덮지 않았다.
- 시각적 딤만 씌우면 키보드 포커스가 뒤쪽 컨트롤에 남는다는 지적을 반영했다. 차단형 로딩 영역은 `aria-busy`와 `inert`를 함께 적용하고, 백그라운드 재검증에는 이 컴포넌트를 사용하지 않는 것으로 범위를 구분했다.
- Storybook을 실제 브라우저에서 1,440px와 390px 너비로 확인했다. 설명이 없는 Select가 같은 행의 TextField 높이에 맞춰 60px로 늘어나던 문제는 내부 grid를 `content-start`로 바꿔 두 컨트롤을 46px로 맞췄고, 모바일 제목이 `화/면`으로 갈라지던 문제에는 한글 단어 단위 줄바꿈을 적용했다.
- 키보드 Tab으로 툴팁을 열고 Escape로 닫았으며, Select의 다음 직무를 선택한 뒤 포커스가 trigger로 돌아오는지 확인했다. 상세 모달도 키보드로 연 뒤 Escape로 닫아 기존 trigger로 포커스가 복귀하는 것을 데스크톱과 390px 화면에서 확인했다.
- 공용 UI 전용 Vitest 15개와 타입·ESLint 검사를 통과했다. 앱과 디자인 갤러리의 첫 AccessLint 스캔에서는 회청색 바탕의 보조 글자 대비가 4.44:1로 탐지돼 색을 조정했다. Storybook이 애플리케이션 밖에 만든 숨은 오류 heading은 검사 범위에서 제외하고 두 화면의 `main`을 다시 스캔해 자동 탐지 위반 0건을 확인했다. 이 결과가 실제 보조기기 사용성 전체를 보장하지는 않는다.
- 첫 Cypress 실행은 기반 화면의 이전 상태 문구를 그대로 기대해 실패했다. 새 문구를 실제 화면과 맞춘 뒤 axe 검사를 포함한 smoke test를 두 번 다시 실행해 통과했고, 전체 검사에서는 Vitest 13개 파일의 72개 테스트와 production·Storybook build가 함께 통과했다.
- 최종 diff를 별도 읽기 전용 리뷰로 다시 확인했다. 공용 컴포넌트의 도메인 역방향 의존, Radix 레이블과 포커스, 로딩 영역 차단, 문서와 실제 구현의 불일치를 중심으로 살폈고 커밋을 막을 P0·P1 항목은 없었다.

## [review-fix] 디자인 시스템 SonarCloud 지적 보완

### 프롬프트 1

> PR #3의 SonarCloud Reliability Rating이 C로 실패했어. check-run annotation의 실제 파일과 줄을 확인하고, 의미나 공개 API를 바꾸지 않는 범위에서 모두 수정해줘. React 컴포넌트 props는 불변 계약으로 표시하고, Storybook의 `Error` 식별자는 상태를 설명하는 이름으로 바꾸며, 인라인 요소 뒤 상태 문구의 공백이 모호하지 않게 구조를 정리해줘. 기존 기능 커밋은 수정하지 말고 별도 보완 커밋으로 남긴 뒤 전체 검사와 PR 재분석을 확인해줘.

### AI 출력 요지

- Modal, SelectField, LoadingOverlay, Tooltip props 객체를 `Readonly`로 표시해 컴포넌트 입력을 변경하지 않는 계약을 타입에 드러냈다.
- 오류 상태 Story 이름을 `WithError`로 바꾸고, 상태 점 뒤의 문구를 별도 요소로 감싸 공백 해석이 모호하지 않게 했다.

### 리뷰 / 검증

- SonarCloud 요약만 보고 추측하지 않고 GitHub check-run annotation API에서 6건의 파일과 줄을 확인했다. 네 건은 props 불변성, 한 건은 `Error` 식별자, 한 건은 인라인 요소 뒤 공백 규칙이었다.
- 모두 동작을 바꾸지 않는 정적 분석 보완으로 한정했다. 기존 디자인 시스템 커밋을 고치지 않고 별도 커밋으로 남겨 원격 재분석 결과를 확인하기로 했다.

## [candidate-query] 후보자 조회 쿼리와 재시도 정책

### 프롬프트 1

> 후보자 목록과 상세 조회를 TanStack Query의 공통 query option으로 만들어줘. 목록은 데이터 크기, 상세는 후보자 ID가 query key에 포함돼 서로 다른 응답이 섞이지 않아야 하고 API 호출에는 Query가 전달한 AbortSignal을 연결해줘. 초기 보드에 필요한 요청은 후보자 목록 하나뿐이므로 단계별 요청으로 나누지 말고, 실제로 독립 조회가 늘어날 때만 병렬 Suspense query를 검토해줘.

### 프롬프트 2

> 전역 Query 재시도는 구조가 검증된 API 오류 중 실제로 재시도 가능한 조회만 한 번 허용해줘. 스키마 오류, 404, 취소 요청, 일반 Error와 형태만 비슷한 객체는 재시도하지 않게 하고 정책을 단위 테스트로 고정해줘.

### AI 출력 요지

- 목록·상세 query key factory와 option factory를 후보자 도메인에 두고 Ky API에 Query의 AbortSignal을 전달했다.
- `ApiError`의 이름만 보지 않고 오류 메타데이터 전체를 확인해 retryable 조회만 한 번 재시도하도록 QueryClient 정책을 좁혔다.

### 리뷰 / 검증

- 초기 화면에 필요한 독립 요청은 후보자 목록 하나뿐이라 `useSuspenseQueries`를 먼저 도입하는 제안은 기각했다. 다섯 단계가 같은 원본을 사용하므로 목록 한 번을 받아 화면에서 분류하는 편이 요청 수와 실패 지점을 줄인다.
- 오류 이름만 `ApiError`인 일반 객체까지 재시도하면 임의 오류를 신뢰하게 된다. `kind`, `retryable`, `safeMessage`, `status` 구조를 함께 확인하도록 보완했다.
- 목록 크기와 후보자 ID가 query key에 반영되는지, AbortSignal이 API로 이어지는지, retryable 503은 한 번만 재시도하고 스키마 오류·404·AbortError·일반 Error는 재시도하지 않는지 전용 Vitest 9개로 확인했다.

## [board-layout] 다섯 단계 보드 레이아웃

### 프롬프트 1

> 채용 파이프라인의 `서류검토 → 면접 → 처우협의 → 최종합격 / 불합격` 다섯 단계를 먼저 보드 열로 배치해줘. 이 단계에서는 후보자 조회나 카드 기능을 섞지 말고 화면 골격만 구현해줘. 데스크톱에서는 다섯 열을 한눈에 비교할 수 있어야 하고, 모바일에서는 문서 전체를 밀어내지 않으면서 보드 안에서 다음 열을 탐색할 수 있게 해줘. 단계 순서와 이름, 키보드 스크롤 진입을 테스트로 고정해줘.

### AI 출력 요지

- 다섯 단계의 순서와 색인 표현을 하나의 presentation map에 두고 동일한 열 컴포넌트로 렌더링했다.
- 보드 바깥 문서는 고정하고 열 컨테이너만 가로로 스크롤되도록 구성했으며 데이터가 연결되기 전 상태를 열 안에 명시했다.

### 리뷰 / 검증

- 단계 순서를 화면마다 다시 적는 초안 대신 기존 후보자 계약의 `CANDIDATE_STAGES`를 그대로 사용했다. 데이터 계약과 보드 순서가 달라지는 중복 상수를 만들지 않기 위해서다.
- 전체 페이지를 가로로 넓히는 grid는 작은 화면에서 문서 overflow를 만들 수 있어 기각했다. `min-width`를 가진 열 묶음을 이름 있는 보드 region 안에서만 스크롤하게 바꿨다.
- 실제 렌더를 캡처해 넓은 데스크톱 화면에서 다섯 열의 헤더·높이·간격이 같은지 확인했다. 별도 Cypress 검증에서는 1,440px의 다섯 열과 390px의 문서 overflow 없음·보드 내부 가로 탐색을 확인했고 2개 시나리오가 통과했다.
- 단계 순서와 키보드 진입을 확인하는 Vitest 2개, 타입 검사, production build와 Storybook production build도 통과했다.

## [card-list] 후보자 목록과 카드 표시

### 프롬프트 1

> 후보자 목록 API를 한 번 호출해 받은 200명을 현재 단계에 따라 다섯 열로 나눠줘. 카드에는 이름, 직무, 지원일, 현재 단계를 모두 표시하고 단계별 인원도 헤더에서 확인할 수 있게 해줘. 이 커밋에는 검색, 상세 열기, 가상 스크롤과 전용 오류 화면을 섞지 말고 기본 목록 렌더까지만 구현해줘. 같은 후보자가 빠지거나 중복되지 않고 단계 안의 원래 순서를 유지하는지 테스트해줘.

### AI 출력 요지

- 후보자 배열을 한 번 순회해 다섯 단계 레코드로 나누는 순수 모델과 단계별 카드 목록을 구현했다.
- 고정된 `size=200` 목록 query 하나를 Suspense에서 읽고 카드에 이름·직무·지원일·현재 단계를 표시했다.

### 리뷰 / 검증

- 단계별로 API를 다섯 번 호출하는 초안은 같은 원본을 중복 조회하고 실패 지점을 늘리므로 기각했다. 목록 응답 하나를 기존 단계 계약에 맞춰 화면에서 분류했다.
- 가상 스크롤을 미리 섞지 않고 이 단계에서는 200개 카드가 DOM에 모두 생기는 기준 동작을 유지했다. 이후 가상화 커밋에서 실제 DOM 수 감소를 같은 데이터로 비교할 수 있다.
- 카드 전체를 곧바로 클릭 버튼으로 만들면 아직 없는 상세 동작을 암시하므로 현재는 의미 있는 `article`로만 표시했다. 상세 기능에서 키보드 활성화와 prefetch를 함께 추가하기로 했다.
- 실제 브라우저 접근성 트리에서 다섯 단계가 각 40명으로 나뉘고 200개 카드에 필수 정보가 포함되는 것을 확인했다. 단계 분류·목록 요청·카드 렌더를 다루는 Vitest 3개 파일의 4개 테스트, ESLint, 타입 검사와 Storybook production build가 통과했다.

## [loading-error-empty] 후보자 조회 상태 처리

### 프롬프트 1

> 후보자 목록의 로딩, 오류, 전체 데이터 없음 상태를 각각 전용 UI로 처리해줘. 로딩 스켈레톤은 실제 결과의 요약 행과 다섯 단계 열 높이를 미리 예약하고, 빈 응답은 검색 결과 없음과 구분해 아직 등록된 데이터가 없다는 안내를 보여줘. API 오류는 서버 원문 대신 정규화된 안전 문구만 표시하고 사용자가 같은 화면에서 다시 시도해 복구할 수 있게 해줘. 검색 결과 없음은 검색 기능에서 별도로 추가하고, 강제 지연·503·0명 응답을 테스트해줘.

### AI 출력 요지

- 단순 상태 문구 대신 결과 화면과 같은 요약 간격, 다섯 단계 헤더와 카드 높이를 가진 전용 스켈레톤을 추가했다.
- 후보자 목록의 Suspense와 Query 오류를 보드 영역에 한정했다. Query와 Error Boundary의 오류 상태를 함께 초기화하는 재시도 흐름도 연결했다.
- 전체 후보자 데이터가 비어 있는 상태를 별도 안내로 처리해 이후 검색 조건에 따른 결과 없음과 구분할 수 있게 했다.

### 리뷰 / 검증

- 초안의 한 줄짜리 로딩 문구는 결과 화면과 구조가 달라 응답 전후에 큰 높이 변화가 생길 수 있어 교체했다. 스켈레톤이 요약 행과 다섯 단계 열을 모두 예약하는지 테스트로 고정했다.
- 앱 전체 Error Boundary에 목록 오류를 맡기면 제목과 기본 맥락까지 사라진다. 오류 경계를 목록 영역으로 좁혀 실패 중에도 채용 보드의 제목과 설명이 유지되도록 했다.
- 첫 코드 리뷰에서 빈 상태의 12px 코랄 문구가 흰색 배경과 2.80:1 대비에 그치고, 오류와 빈 상태의 최소 높이가 스켈레톤보다 작다는 지적을 받았다. 문구를 코발트 진한 색으로 바꾸고 실제로 측정한 전체 보드 높이인 42.125rem을 두 상태에도 적용했다. 아직 없는 검색 결과 없음까지 검증하는 것처럼 읽히던 테스트 이름도 현재 범위인 전체 데이터 없음으로 좁혔다.
- 503 응답 본문에 내부 문구를 넣은 테스트에서 화면에는 `ApiError.safeMessage`만 나타나고 원문은 노출되지 않는지 확인했다. 처음 두 요청을 실패시켜 자동 재시도를 소진한 뒤 오류 화면을 확인했고, 사용자가 다시 시도하면 세 번째 요청에서 목록이 복구되는 흐름까지 검증했다. 정규화되지 않은 일반 오류도 원문 대신 고정된 안전 문구만 보여 주도록 별도 테스트를 추가했다.
- 후속 접근성 리뷰에서는 busy 상태인 live region이 해제되기 전에 사라질 수 있고, 재시도 버튼이 교체될 때 키보드 포커스가 본문으로 빠질 수 있다는 의견이 나왔다. 스켈레톤 status에서 `aria-busy`를 제거해 로딩 문구가 바로 전달되게 했다. 키보드 재시도는 계속 남아 있는 보드 영역으로 포커스를 옮기고 복구된 인원을 별도 status로 알리되, 포인터 클릭의 포커스는 강제로 움직이지 않는다. 스켈레톤 카드와 인원 표시 자리도 실제 보드 치수에 맞췄다.
- 포인터와 키보드 재시도 분기를 고정하는 마지막 테스트를 추가한 뒤 첫 전체 검사는 새 테스트 파일의 Prettier 형식 때문에 중단됐다. 해당 파일만 포맷한 다음 전체 검사를 처음부터 다시 실행했다.
- 지연된 응답, 0명 응답, 503 뒤 재시도를 포함한 전용 Vitest 2개 파일의 8개 테스트가 통과했다. 전체 `pnpm check`에서도 19개 파일의 92개 테스트와 format, ESLint, Secretlint, Knip, 타입 검사, production 및 Storybook build가 모두 통과했다. 정상 보드와 로딩·빈 상태·오류 Story의 `main`을 각각 다시 스캔한 AccessLint 자동 탐지 위반은 0건이었고, 데스크톱·모바일 보드 Cypress 2개 시나리오도 두 번 연속 통과했다.
- 첫 커밋 시도는 본문 한 줄이 100자를 넘겨 Commitlint에서 거부됐고 커밋은 생성되지 않았다. 검증 내용은 줄을 나눠 같은 변경으로 다시 커밋했다.
