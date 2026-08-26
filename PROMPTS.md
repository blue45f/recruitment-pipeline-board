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
