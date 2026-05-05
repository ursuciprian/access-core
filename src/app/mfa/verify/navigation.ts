export function getPostVerifyDestination(options: {
  callbackUrl: string | null
  isApproved: boolean
}) {
  if (!options.isApproved) {
    return '/pending-approval'
  }

  const callbackUrl = getSafeCallbackUrl(options.callbackUrl)

  if (callbackUrl === '/' || callbackUrl === '/mfa/verify') {
    return '/'
  }

  return callbackUrl
}

export function getSafeCallbackUrl(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return '/'
  }

  return value
}
