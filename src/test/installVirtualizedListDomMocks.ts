import { vi } from 'vitest'

const VIRTUAL_LIST_HEIGHT = 544
const VIRTUAL_LIST_WIDTH = 288
const VIRTUAL_ITEM_HEIGHT = 160

class ResizeObserverMock implements ResizeObserver {
  readonly #callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
  }

  disconnect() {
    return undefined
  }

  observe(target: Element) {
    const element = target as HTMLElement
    const blockSize = element.offsetHeight
    const inlineSize = element.offsetWidth

    this.#callback(
      [
        {
          borderBoxSize: [{ blockSize, inlineSize }],
          contentBoxSize: [{ blockSize, inlineSize }],
          contentRect: element.getBoundingClientRect(),
          devicePixelContentBoxSize: [{ blockSize, inlineSize }],
          target,
        } as ResizeObserverEntry,
      ],
      this,
    )
  }

  unobserve() {
    return undefined
  }
}

export function installVirtualizedListDomMocks() {
  const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight',
  )
  const offsetWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth',
  )
  const scrollToDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollTo',
  )
  const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'ResizeObserver',
  )
  const offsetHeightSpy = vi
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      if (this.dataset.virtualizedCandidateList !== undefined) {
        return VIRTUAL_LIST_HEIGHT
      }

      if (this.dataset.virtualizedCandidateItem !== undefined) {
        return VIRTUAL_ITEM_HEIGHT
      }

      return offsetHeightDescriptor?.get?.call(this) ?? 0
    })
  const offsetWidthSpy = vi
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.dataset.virtualizedCandidateList !== undefined
        ? VIRTUAL_LIST_WIDTH
        : (offsetWidthDescriptor?.get?.call(this) ?? 0)
    })

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
    writable: true,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: function scrollTo(
      this: HTMLElement,
      leftOrOptions: number | ScrollToOptions = {},
      top = 0,
    ) {
      if (typeof leftOrOptions === 'number') {
        this.scrollLeft = leftOrOptions
        this.scrollTop = top
      } else {
        this.scrollLeft = leftOrOptions.left ?? this.scrollLeft
        this.scrollTop = leftOrOptions.top ?? this.scrollTop
      }

      this.dispatchEvent(new Event('scroll'))
    },
    writable: true,
  })

  return () => {
    offsetHeightSpy.mockRestore()
    offsetWidthSpy.mockRestore()

    if (resizeObserverDescriptor) {
      Object.defineProperty(
        globalThis,
        'ResizeObserver',
        resizeObserverDescriptor,
      )
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver')
    }

    if (scrollToDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollTo',
        scrollToDescriptor,
      )
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
    }
  }
}
