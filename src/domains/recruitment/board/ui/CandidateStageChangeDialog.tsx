import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { useId, type RefObject } from 'react'
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
  getCandidateStageMoveErrorMessage,
  type CandidateStageChangeFormValues,
} from '../model'

export type CandidateStageChangeDialogProps = Readonly<{
  candidate: Candidate
  fallbackFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
  onMoveCandidate: (
    candidate: Candidate,
    stage: CandidateStage,
  ) => Promise<Candidate>
}>

export function CandidateStageChangeDialog({
  candidate,
  fallbackFocusRef,
  onClose,
  onMoveCandidate,
}: CandidateStageChangeDialogProps) {
  const formId = useId()
  const formSchema = createCandidateStageChangeFormSchema(
    candidate.currentStage,
  )
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<CandidateStageChangeFormValues>({
    resolver: zodResolver(formSchema),
  })
  const availableStages = CANDIDATE_STAGES.filter(
    (stage) => stage !== candidate.currentStage,
  )
  const stageErrorId = `${formId}-stage-error`

  return (
    <Modal
      closeDisabled={isSubmitting}
      description={`${candidate.name} 후보자의 현재 단계는 ${CANDIDATE_STAGE_LABELS[candidate.currentStage]}입니다.`}
      footer={
        <>
          <Button disabled={isSubmitting} onClick={onClose} variant="ghost">
            취소
          </Button>
          <Button
            form={formId}
            loading={isSubmitting}
            loadingLabel={`${candidate.name} 후보자 단계 저장 중`}
            type="submit"
          >
            변경하기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </>
      }
      onCloseAutoFocus={(event) => {
        const stageChangeButton = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[data-stage-change-candidate-id]',
          ),
        )
          .filter(
            (button) =>
              button.dataset.stageChangeCandidateId === candidate.id &&
              !button.disabled,
          )
          .at(-1)

        event.preventDefault()

        if (stageChangeButton) {
          stageChangeButton.focus()
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
        if (!open && !isSubmitting) {
          onClose()
        }
      }}
      open
      title={`${candidate.name} 후보자 단계 변경`}
    >
      <form
        id={formId}
        onSubmit={handleSubmit(async ({ stage }) => {
          try {
            await onMoveCandidate(candidate, stage)
            onClose()
          } catch (error) {
            setError('root.server', {
              message: getCandidateStageMoveErrorMessage(error),
              type: 'server',
            })
          }
        })}
      >
        <fieldset
          aria-describedby={errors.stage ? stageErrorId : undefined}
          className="space-y-3"
          disabled={isSubmitting}
        >
          <legend className="text-sm font-bold text-[var(--color-ink)]">
            이동할 단계
          </legend>
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            저장이 끝나면 후보자 카드와 상세 정보에 새 단계가 반영됩니다.
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

        {errors.root?.server ? (
          <p
            className="mt-4 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-danger)]"
            role="alert"
          >
            {errors.root.server.message}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
