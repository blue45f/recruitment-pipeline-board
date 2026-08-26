import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

describe('LoadingOverlay', () => {
  it('보이지 않을 때 상태 영역을 접근성 트리에 노출하지 않는다', () => {
    render(<LoadingOverlay label="후보자 목록을 불러오는 중" visible={false} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('보일 때 진행 상태를 접근 가능한 이름과 함께 알린다', () => {
    render(<LoadingOverlay label="후보자 목록을 불러오는 중" visible />)

    expect(screen.getByRole('status')).toHaveAccessibleName(
      '후보자 목록을 불러오는 중',
    )
  })

  it('자식 콘텐츠를 감쌀 때 로딩 중인 영역과 배경 상호작용을 구분한다', () => {
    render(
      <LoadingOverlay label="후보자 목록을 불러오는 중" visible>
        <button type="button">후보자 카드 열기</button>
      </LoadingOverlay>,
    )

    expect(
      screen.getByRole('button', {
        hidden: true,
        name: '후보자 카드 열기',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('후보자 카드 열기', {
        selector: '[aria-busy="true"] *',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('후보자 카드 열기', {
        selector: '[inert] *',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: '후보자 목록을 불러오는 중' }),
    ).toBeInTheDocument()
  })

  it('로딩이 끝나면 자식 콘텐츠를 다시 조작할 수 있게 한다', () => {
    render(
      <LoadingOverlay label="후보자 목록을 불러오는 중" visible={false}>
        <button type="button">후보자 카드 열기</button>
      </LoadingOverlay>,
    )

    expect(
      screen.getByRole('button', {
        name: '후보자 카드 열기',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('후보자 카드 열기', {
        selector: '[aria-busy="false"] *',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('후보자 카드 열기', {
        selector: '[inert] *',
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
