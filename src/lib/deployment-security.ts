export interface DeploymentSecurityIssue {
  id: string
  severity: 'critical' | 'warning'
  message: string
}

export function validateDeploymentSecurityConfig(env: NodeJS.ProcessEnv = process.env): DeploymentSecurityIssue[] {
  const issues: DeploymentSecurityIssue[] = []
  const isProduction = env.NODE_ENV === 'production'

  if (!isProduction) {
    return issues
  }

  if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET === 'replace-this-before-deploying') {
    issues.push({
      id: 'default-nextauth-secret',
      severity: 'critical',
      message: 'NEXTAUTH_SECRET must be set to a strong non-default value in production.',
    })
  }

  if (env.ALLOW_UNSAFE_INLINE_CSP === 'true' || env.ALLOW_UNSAFE_DEV_CSP === 'true') {
    issues.push({
      id: 'relaxed-production-csp',
      severity: 'critical',
      message: 'Production must not enable unsafe inline/eval CSP relaxations.',
    })
  }

  const databaseUrl = env.DATABASE_URL ?? ''
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(databaseUrl)) {
    issues.push({
      id: 'local-production-database',
      severity: 'warning',
      message: 'Production DATABASE_URL should point to a private managed or local service endpoint, not localhost-style development defaults.',
    })
  }

  return issues
}
