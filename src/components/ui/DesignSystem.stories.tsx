import type { Meta, StoryObj } from '@storybook/react-vite'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Tooltip as RadixTooltip } from 'radix-ui'
import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { Modal } from '@/components/ui/Modal'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { Tooltip } from '@/components/ui/Tooltip'

const palette = [
  { color: '#F4F7FB', name: 'Fog' },
  { color: '#FFFFFF', name: 'Paper' },
  { color: '#182033', name: 'Ink' },
  { color: '#315EFB', name: 'Cobalt' },
  { color: '#FF6B57', name: 'Coral' },
  { color: '#18785F', name: 'Success' },
]

const roleOptions = [
  { label: '전체 직무', value: 'all' },
  { label: '프론트엔드 개발자', value: 'frontend' },
  { label: '프로덕트 디자이너', value: 'designer' },
]

const meta = {
  title: 'Shared/Design System Gallery',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function Gallery() {
  const [role, setRole] = useState('all')

  return (
    <main className="min-h-screen bg-[var(--color-surface)] p-6 text-[var(--color-ink)] sm:p-10">
      <div className="mx-auto grid max-w-6xl gap-8">
        <header className="border-l-4 border-[var(--color-coral)] pl-5">
          <p className="font-data text-xs tracking-[0.18em] text-[var(--color-cobalt)] uppercase">
            Recruitment workspace · UI inventory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] break-keep sm:text-4xl">
            채용 흐름을 빠르게 읽는 화면
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 break-keep text-[var(--color-muted)] sm:text-base">
            반복되는 조작은 조용하게, 중요한 상태 변화는 분명하게 구분합니다.
          </p>
        </header>

        <section aria-labelledby="palette-heading">
          <h2 id="palette-heading" className="text-lg font-bold">
            Palette
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3 lg:grid-cols-6">
            {palette.map(({ color, name }) => (
              <div key={name} className="bg-[var(--color-paper)] p-3">
                <div
                  aria-hidden="true"
                  className="h-16 rounded-xl border border-black/10"
                  style={{ backgroundColor: color }}
                />
                <p className="mt-3 text-sm font-semibold">{name}</p>
                <p className="font-data mt-0.5 text-xs text-[var(--color-muted)]">
                  {color}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            aria-labelledby="controls-heading"
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 sm:p-6"
          >
            <h2 id="controls-heading" className="text-lg font-bold">
              Actions &amp; inputs
            </h2>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button>변경 저장</Button>
              <Button variant="secondary">취소</Button>
              <Button variant="ghost">필터 초기화</Button>
              <Button variant="danger">불합격 처리</Button>
              <Tooltip content="검색 조건 설정">
                <Button
                  aria-label="검색 조건 설정"
                  size="icon"
                  variant="secondary"
                >
                  <SlidersHorizontal aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <TextField
                description="이름 일부만 입력해도 검색됩니다."
                label="후보자 검색"
                name="candidate-search"
                placeholder="이름을 입력하세요"
              />
              <SelectField
                label="직무"
                name="role"
                onValueChange={setRole}
                options={roleOptions}
                value={role}
              />
            </div>
          </section>

          <section
            aria-labelledby="states-heading"
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 sm:p-6"
          >
            <h2 id="states-heading" className="text-lg font-bold">
              Status &amp; feedback
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge>서류검토</Badge>
              <Badge tone="info">면접</Badge>
              <Badge tone="attention">처우협의</Badge>
              <Badge tone="success">최종합격</Badge>
              <Badge tone="danger">불합격</Badge>
            </div>

            <LoadingOverlay
              containerClassName="mt-6 min-h-40 overflow-hidden rounded-xl border border-[var(--color-line)]"
              label="검색 결과를 불러오는 중"
              visible
            >
              <div className="p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Search aria-hidden="true" size={16} /> 검색 결과
                </p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  목록 영역만 딤 처리하여 나머지 조작은 유지합니다.
                </p>
              </div>
            </LoadingOverlay>
          </section>
        </div>

        <section
          aria-labelledby="dialog-heading"
          className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-5 sm:p-6"
        >
          <h2 id="dialog-heading" className="text-lg font-bold">
            Dialog
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            세부 정보는 현재 맥락을 유지하는 모달에서 확인합니다.
          </p>
          <div className="mt-5">
            <Modal
              description="지원 정보와 현재 채용 단계를 확인합니다."
              footer={<Button variant="secondary">확인</Button>}
              title="김토스 후보자"
              trigger={<Button variant="secondary">상세 정보 열기</Button>}
            >
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--color-muted)]">지원 직무</dt>
                  <dd className="mt-1 font-semibold">프론트엔드 개발자</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">현재 단계</dt>
                  <dd className="mt-1 font-semibold">면접</dd>
                </div>
              </dl>
            </Modal>
          </div>
        </section>
      </div>
    </main>
  )
}

export const DesignSystemGallery: Story = {
  render: () => (
    <RadixTooltip.Provider delayDuration={0}>
      <Gallery />
    </RadixTooltip.Provider>
  ),
}
