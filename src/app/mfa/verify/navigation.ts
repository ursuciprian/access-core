export function getPostVerifyDestination(options: {
  callbackUrl: string | null
  isApproved: boolean
}) {
  if (!options.isApproved) {
    return '/pending-approval'
  }

  if (!options.callbackUrl || options.callbackUrl === '/mfa/verify') {
    return '/'
  }

  return options.callbackUrl
}
