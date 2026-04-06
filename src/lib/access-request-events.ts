export const ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT = 'access-requests:pending-count-changed'
export const PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT = 'portal-access:pending-count-changed'

export function notifyAccessRequestPendingCountChanged() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(ACCESS_REQUEST_PENDING_COUNT_CHANGED_EVENT))
}

export function notifyPortalAccessPendingCountChanged() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(PORTAL_ACCESS_PENDING_COUNT_CHANGED_EVENT))
}
