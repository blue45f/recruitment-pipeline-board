# Recruitment Pipeline Board

지원자의 채용 단계를 한 화면에서 확인하고 관리하는 프런트엔드 과제입니다. 기능을 작은 단위로 구현하고, 각 단계에서 사용한 프롬프트와 검증 결과를 함께 남깁니다.

현재는 애플리케이션 골격과 자동 검증 환경, 후보자 데이터 계약, Mock API와 검증된 API 클라이언트, 공용 디자인 시스템을 갖췄습니다. 그 위에 다섯 단계 보드와 후보자 상세, 단계 이동을 연결했습니다. 표시할 데이터는 0명, 200명, 1,000명 중에서 고를 수 있고 선택값은 새로고침 뒤에도 유지됩니다. 이름과 직무로 조회한 목록을 바로 좁힐 수 있습니다. 각 단계는 화면에 보이는 카드만 렌더링해 1,000명 목록에서도 DOM 크기를 일정하게 유지합니다. 단계 이동은 즉시 화면에 반영되고 서버가 확정한 최근 이동은 한 번 되돌릴 수 있습니다.

보드와 상세 화면은 고정된 Linux·Chrome 환경에서 데스크톱과 모바일 기준 이미지를 비교합니다. 비교 기준을 넘는 픽셀이 하나라도 있으면 PR의 visual-regression 작업이 실패하며 차이 이미지는 실패한 실행의 산출물로만 남깁니다.

## 실행 방법

```bash
pnpm install
pnpm dev
```

전체 정적 검사와 테스트는 `pnpm check`, 브라우저 테스트는 `pnpm e2e:ci`로 실행합니다.

### 현재 구현된 화면

- `서류검토 → 면접 → 처우협의 → 최종합격 / 불합격` 순서의 5단계 보드
- 목록 API 한 번으로 조회한 200명 또는 1,000명의 단계별 카드
- 0명, 200명, 1,000명으로 바꿀 수 있고 새로고침 뒤에도 복원되는 표시 수
- 각 단계에서 화면에 보이는 카드만 렌더링하는 가상 목록
- 방향키와 Home, End로 카드를 이동하고 전체 목록 안의 위치를 전달하는 접근성 정보
- 이름·직무·지원일·현재 단계를 포함한 후보자 카드
- 후보자명·이메일·경력·지원일·현재 단계·메모를 보여 주는 상세 모달
- 포인터와 키보드 탐색 의도를 확인한 뒤 시작하는 상세 데이터 prefetch
- 목록을 유지한 채 처리하는 상세 로딩·오류·재시도
- URL에 복원되는 이름 검색과 직무 필터
- 전체 데이터 없음과 구분되는 검색 결과 없음 및 조건 초기화
- 실제 보드 크기를 예약하는 로딩 스켈레톤과 전체 데이터 빈 상태
- 서버 원문을 노출하지 않는 조회 오류 안내와 다시 시도
- 데스크톱의 5열 보기와 모바일 보드 내부 가로 탐색
- 키보드 포커스를 받을 수 있는 보드 스크롤 영역
- Enter·Space로 카드 열기, Escape·닫기 뒤 원래 카드로 포커스 복귀
- 후보자별 직렬 처리와 전체 네 건의 동시 요청 제한을 적용한 단계 이동
- 서버가 검증한 최근 확정 이동을 한 번만 보상하는 Undo
- 이동 실패의 작업 단위 rollback, 안전한 재시도와 결과 재확인

### Mock API

MSW가 후보자 목록·상세·단계 변경 요청을 가로챕니다. 고정 seed로 만든 1,000명을 원본으로 사용하고 단계 변경만 버전이 있는 localStorage overlay에 저장합니다. 정상 요청에는 200~800ms 지연과 약 15% 실패가 적용됩니다. 단계 변경은 revision과 멱등 키를 검증하며 확정된 일반 이동에는 한 번만 사용할 수 있는 Undo receipt를 돌려줍니다. 보상 이력도 같은 저장 경계에서 관리하므로 중복 실행이나 여러 탭의 경쟁 상태가 확정 단계를 덮지 못합니다.

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
- Tailwind CSS, Radix UI, TanStack Virtual
- Vitest, Testing Library, Cypress, Storybook
- ESLint, Prettier, Secretlint, Knip
- SonarQube Community Build
- Husky, lint-staged, Commitlint

## 디자인 원칙

밝은 회청색 바탕과 흰 패널, 짙은 남색 본문, 코발트 주요 동작을 기준으로 화면 위계를 나눕니다. 코랄은 의미를 전달하는 텍스트나 컨트롤 대신 문서 색인의 작은 표식에만 사용합니다. 외부 폰트를 내려받지 않고 시스템 글꼴을 사용해 첫 렌더의 지연과 레이아웃 이동을 피합니다.

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
