import { ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT, notifyAccessRequestPendingCountChanged } from '@/lib/access-request-events'

describe('access request events', () => {
  it('dispatches a pending-count refresh event', () => {
    const fakeWindow = new EventTarget() as EventTarget & typeof globalThis
    const listener = vi.fn()

    vi.stubGlobal('window', fakeWindow)

    window.addEventListener(ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT, listener)
    notifyAccessRequestPendingCountChanged()

    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT, listener)
    vi.unstubAllGlobals()
  })
})
