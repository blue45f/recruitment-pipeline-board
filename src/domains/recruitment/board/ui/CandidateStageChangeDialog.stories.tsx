import type { Meta, StoryObj } from '@storybook/react-vite'
import { createRef, useRef, useState } from 'react'
import { fn } from 'storybook/test'

import { Button } from '@/components/ui/Button'
import {
  CANDIDATE_STAGE_LABELS,
  type Candidate,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

import {
  CandidateStageChangeDialog,
  type CandidateStageChangeDialogProps,
} from './CandidateStageChangeDialog'

const candidate: Candidate = {
  id: 'candidate-stage-story',
  name: '김하늘',
  role: 'frontend_engineer',
  appliedAt: '2026-08-12T09:00:00.000Z',
  currentStage: 'document_review',
  email: 'haneul.kim@example.test',
  experienceYears: 6,
  memo: '접근 가능한 단계 변경 흐름을 확인하는 Story 후보자입니다.',
  stageChangedAt: '2026-08-19T09:00:00.000Z',
  revision: 1,
}

const moveCandidate = fn(
  async (sourceCandidate: Candidate, stage: CandidateStage) => ({
    ...sourceCandidate,
    currentStage: stage,
    revision: sourceCandidate.revision + 1,
    stageChangedAt: '2026-08-26T12:00:00.000Z',
  }),
)

function StageChangeDialogFrame({
  candidate,
  onClose,
  onMoveCandidate,
}: Omit<CandidateStageChangeDialogProps, 'fallbackFocusRef'>) {
  const fallbackFocusRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(true)
  const [visibleCandidate, setVisibleCandidate] = useState(candidate)

  return (
    <main className="min-h-svh bg-[var(--color-fog)] p-6">
      <section
        aria-label="단계 변경 Story 배경"
        className="mx-auto max-w-xl rounded-2xl bg-[var(--color-paper)] p-6"
        ref={fallbackFocusRef}
        tabIndex={-1}
      >
        <h1 className="text-xl font-bold">후보자 단계 변경</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          다이얼로그를 닫으면 이 영역으로 포커스가 돌아옵니다. 닫은 뒤 다시 열어
          포커스 복귀와 변경 결과를 반복해서 확인할 수 있습니다.
        </p>
        <p className="mt-4 text-sm font-semibold">
          현재 단계: {CANDIDATE_STAGE_LABELS[visibleCandidate.currentStage]}
        </p>
        <Button className="mt-4" onClick={() => setOpen(true)}>
          단계 변경 다시 열기
        </Button>
      </section>
      {open ? (
        <CandidateStageChangeDialog
          candidate={visibleCandidate}
          fallbackFocusRef={fallbackFocusRef}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          onMoveCandidate={async (sourceCandidate, stage) => {
            const movedCandidate = await onMoveCandidate(sourceCandidate, stage)

            setVisibleCandidate(movedCandidate)
            return movedCandidate
          }}
        />
      ) : null}
    </main>
  )
}

const meta = {
  args: {
    candidate,
    fallbackFocusRef: createRef<HTMLElement>(),
    onClose: fn(),
    onMoveCandidate: moveCandidate,
  },
  component: CandidateStageChangeDialog,
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ candidate, onClose, onMoveCandidate }) => (
    <StageChangeDialogFrame
      candidate={candidate}
      onClose={onClose}
      onMoveCandidate={onMoveCandidate}
    />
  ),
  title: 'Recruitment/Candidate stage change dialog',
} satisfies Meta<typeof CandidateStageChangeDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
