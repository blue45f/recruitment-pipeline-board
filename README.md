# Recruitment Pipeline Board

지원자의 채용 단계를 한 화면에서 확인하고 관리하는 프런트엔드 과제입니다. 기능을 작은 단위로 구현하고, 각 단계에서 사용한 프롬프트와 검증 결과를 함께 남깁니다.

현재는 애플리케이션 골격과 자동 검증 환경, 후보자 데이터 계약까지 구성한 상태입니다. Mock API와 보드 기능은 다음 커밋부터 순서대로 연결합니다.

## 실행 방법

```bash
pnpm install
pnpm dev
```

전체 정적 검사와 테스트는 `pnpm check`, 브라우저 테스트는 `pnpm e2e:ci`로 실행합니다.

### 로컬 SonarQube

SonarQube 분석은 일상적인 검사와 분리해 필요할 때만 실행합니다.

```bash
pnpm sonar:up
# http://localhost:9000에서 프로젝트와 분석 토큰을 만든 뒤
SONAR_TOKEN=<발급한 토큰> pnpm sonar:scan
pnpm sonar:down
```

`sonar:down`은 분석 기록이 담긴 Docker volume을 지우지 않습니다.
SonarQube Community Build의 공식 최소 사양에 맞춰 Docker에 4GB 이상의 여유 메모리가 필요합니다.

## 기술 구성

- React 19, Vite 8, TypeScript, React Compiler
- React Router, TanStack Query, Zustand
- Ky, MSW, Zod, React Hook Form
- Tailwind CSS, Radix UI
- Vitest, Testing Library, Cypress, Storybook
- ESLint, Prettier, Secretlint, Knip
- SonarQube Community Build
- Husky, lint-staged, Commitlint

## 디렉터리 원칙

```text
src/
├── app/                  # provider와 router 조립
├── routes/               # URL 진입점
├── domains/recruitment/  # 채용 도메인에서 함께 변경되는 코드
├── components/           # 둘 이상의 영역에서 재사용하는 UI
├── lib/                  # 공용 인프라와 유틸리티
├── mocks/                # MSW 실행 환경
└── test/                 # 테스트 공통 설정
```

도메인 코드는 전역 `features`, `hooks`, `types`, `utils` 폴더로 흩뜨리지 않고 함께 변경되는 파일끼리 가깝게 둡니다. `app → routes → domains → components/lib` 방향의 의존성은 ESLint로 검사합니다.

## 커밋 규칙

- 기능 하나를 커밋 하나와 `PROMPTS.md` 섹션 하나에 대응시킵니다.
- 제목은 `type(scope): 한글 요약` 형식을 사용합니다.
- 본문에는 `변경:`, `이유:`, `AI 검토:`를 적습니다.
- squash, amend, rebase, force push로 이미 남긴 작업 순서를 바꾸지 않습니다.

## 문서

- [PROMPTS.md](./PROMPTS.md): 기능별 요청과 AI 출력 검증 기록
- [DECISIONS.md](./DECISIONS.md): 주요 설계 선택과 보류한 대안
