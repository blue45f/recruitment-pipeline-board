import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BoardErrorFallback } from './BoardErrorFallback'
import { CandidateBoardSkeleton } from './CandidateBoardSkeleton'
import { CandidateEmptyState } from './CandidateEmptyState'

describe('candidate board feedback', () => {
  it('결과 레이아웃과 같은 다섯 단계 높이를 로딩 중에 예약한다', () => {
    render(<CandidateBoardSkeleton />)

    expect(
      screen.getByRole('status', {
        name: '후보자 목록을 불러오는 중입니다',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('candidate-stage-skeleton')).toHaveLength(5)
    expect(screen.getByTestId('candidate-board-summary-skeleton')).toHaveClass(
      'mb-4',
      'h-5',
    )
  })

  it('전체 후보자 데이터가 비어 있음을 안내한다', () => {
    render(<CandidateEmptyState reason="no-candidates" />)

    const emptyState = screen.getByRole('status')

    expect(emptyState).toHaveClass('min-h-[42.125rem]')
    expect(
      screen.getByRole('heading', { name: '등록된 후보자가 없습니다' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '후보자 데이터가 추가되면 채용 단계별로 이곳에 표시됩니다.',
      ),
    ).toBeInTheDocument()
  })

  it('예상하지 못한 오류의 내부 문구를 화면에 노출하지 않는다', () => {
    const internalMessage = 'internal stack with secret'

    render(
      <BoardErrorFallback
        error={new Error(internalMessage)}
        onRetry={() => undefined}
      />,
    )

    const errorAlert = screen.getByRole('alert')

    expect(errorAlert).toHaveClass('min-h-[42.125rem]')
    expect(errorAlert).toHaveTextContent('후보자 정보를 표시하지 못했습니다.')
    expect(errorAlert).not.toHaveTextContent(internalMessage)
  })

  it('포인터로 누른 재시도를 키보드 활성화와 구분한다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(<BoardErrorFallback error={new Error('failed')} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onRetry).toHaveBeenCalledWith('pointer')
  })

  it('검색 결과가 없으면 전체 데이터 빈 상태와 다른 안내를 제공한다', async () => {
    const user = userEvent.setup()
    const onClearFilters = vi.fn()

    render(
      <CandidateEmptyState
        onClearFilters={onClearFilters}
        reason="no-results"
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: '조건에 맞는 후보자가 없습니다',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('등록된 후보자가 없습니다'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '검색 조건 지우기' }))

    expect(onClearFilters).toHaveBeenCalledWith('pointer')
  })
})
