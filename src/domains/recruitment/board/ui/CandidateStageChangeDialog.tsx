import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { useId, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  CANDIDATE_STAGES,
  CANDIDATE_STAGE_LABELS,
  type Candidate,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

import {
  createCandidateStageChangeFormSchema,
  type CandidateStageChangeFormValues,
} from '../model'

export type CandidateStageChangeDialogProps = Readonly<{
  candidate: Candidate
  fallbackFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
  onMoveCandidate: (candidate: Candidate, stage: CandidateStage) => void
}>

export function CandidateStageChangeDialog({
  candidate,
  fallbackFocusRef,
  onClose,
  onMoveCandidate,
}: CandidateStageChangeDialogProps) {
  const formId = useId()
  const [openingTrigger] = useState(() => {
    const activeElement = document.activeElement

    return activeElement instanceof HTMLButtonElement &&
      activeElement.dataset.stageChangeCandidateId === candidate.id
      ? activeElement
      : null
  })
  const formSchema = createCandidateStageChangeFormSchema(
    candidate.currentStage,
  )
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CandidateStageChangeFormValues>({
    resolver: zodResolver(formSchema),
  })
  const availableStages = CANDIDATE_STAGES.filter(
    (stage) => stage !== candidate.currentStage,
  )
  const stageErrorId = `${formId}-stage-error`

  return (
    <Modal
      description={`${candidate.name} 후보자의 현재 단계는 ${CANDIDATE_STAGE_LABELS[candidate.currentStage]}입니다.`}
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            취소
          </Button>
          <Button form={formId} type="submit">
            변경하기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </>
      }
      onCloseAutoFocus={(event) => {
        event.preventDefault()

        if (
          openingTrigger !== null &&
          openingTrigger.isConnected &&
          !openingTrigger.disabled
        ) {
          openingTrigger.focus()
          return
        }

        const stageChangeButton = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[data-stage-change-candidate-id]',
          ),
        ).findLast(
          (button) =>
            button.dataset.stageChangeCandidateId === candidate.id &&
            !button.disabled,
        )

        if (stageChangeButton) {
          stageChangeButton.focus()
          return
        }

        const candidateDetail = Array.from(
          document.querySelectorAll<HTMLElement>('[data-candidate-detail-id]'),
        ).find((detail) => detail.dataset.candidateDetailId === candidate.id)

        if (candidateDetail) {
          candidateDetail.focus()
          return
        }

        fallbackFocusRef.current?.focus()
      }}
      onOpenAutoFocus={(event) => {
        const firstStageInput = document
          .getElementById(formId)
          ?.querySelector<HTMLInputElement>('input[type="radio"]')

        if (firstStageInput) {
          event.preventDefault()
          firstStageInput.focus()
        }
      }}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      open
      title={`${candidate.name} 후보자 단계 변경`}
    >
      <form
        id={formId}
        onSubmit={handleSubmit(({ stage }) => {
          onMoveCandidate(candidate, stage)
          onClose()
        })}
      >
        <fieldset
          aria-describedby={errors.stage ? stageErrorId : undefined}
          className="space-y-3"
        >
          <legend className="text-sm font-bold text-[var(--color-ink)]">
            이동할 단계
          </legend>
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            선택한 단계는 바로 반영되며, 저장하지 못하면 이전 단계로 돌아갑니다.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableStages.map((stage) => (
              <label
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-paper)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-cobalt)] hover:bg-[var(--color-cobalt-soft)] has-[:checked]:border-[var(--color-cobalt)] has-[:checked]:bg-[var(--color-cobalt-soft)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-[var(--color-focus)] has-[:focus-visible]:ring-offset-2"
                key={stage}
              >
                <input
                  className="size-4 accent-[var(--color-cobalt)] outline-none"
                  type="radio"
                  value={stage}
                  {...register('stage')}
                />
                {CANDIDATE_STAGE_LABELS[stage]}
              </label>
            ))}
          </div>
          {errors.stage ? (
            <p
              className="text-sm font-semibold text-[var(--color-danger)]"
              id={stageErrorId}
              role="alert"
            >
              {errors.stage.message}
            </p>
          ) : null}
        </fieldset>
      </form>
    </Modal>
  )
}
