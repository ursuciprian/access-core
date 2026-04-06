import {
  ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT,
  PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT,
  notifyAccessRequestPendingCountChanged,
  notifyPortalAccessPendingCountChanged,
} from '@/lib/access-request-events'

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

  it('dispatches a portal-access pending-count refresh event', () => {
    const fakeWindow = new EventTarget() as EventTarget & typeof globalThis
    const listener = vi.fn()

    vi.stubGlobal('window', fakeWindow)

    window.addEventListener(PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT, listener)
    notifyPortalAccessPendingCountChanged()

    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT, listener)
    vi.unstubAllGlobals()
  })
})
