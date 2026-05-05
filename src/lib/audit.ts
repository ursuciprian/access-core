import { prisma } from './prisma'

type AuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'CERT_GENERATED'
  | 'CERT_REVOKED'
  | 'CERT_REGENERATED'
  | 'CCD_PUSHED'
  | 'GROUP_CREATED'
  | 'GROUP_UPDATED'
  | 'GROUP_DELETED'
  | 'GROUP_MEMBER_ADDED'
  | 'GROUP_MEMBER_REMOVED'
  | 'USER_FLAGGED'
  | 'FLAG_RESOLVED'
  | 'SERVER_CREATED'
  | 'SERVER_UPDATED'
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'IMPORT_COMPLETED'
  | 'ADMIN_USER_CREATED'
  | 'ADMIN_USER_UPDATED'
  | 'ADMIN_USER_APPROVED'
  | 'ADMIN_USER_REJECTED'
  | 'ADMIN_USER_PASSWORD_RESET'
  | 'ADMIN_USER_MFA_RESET'
  | 'ADMIN_USER_DELETED'
  | 'TEMP_ACCESS_GRANTED'
  | 'TEMP_ACCESS_REVOKED'
  | 'TEMP_ACCESS_EXPIRED'
  | 'ACCESS_REQUEST_CREATED'
  | 'ACCESS_REQUEST_PROVISIONING_STARTED'
  | 'ACCESS_REQUEST_APPROVED'
  | 'ACCESS_REQUEST_PROVISIONING_FAILED'
  | 'ACCESS_REQUEST_REJECTED'
  | 'ACCESS_REQUEST_AUTO_EXPIRED'
  | 'ACCESS_REQUEST_CANCELED'
  | 'CONFIG_DOWNLOADED'
  | 'SESSION_KILLED'
  | 'PASSWORD_CHANGED'
  | 'MFA_SETUP_STARTED'
  | 'MFA_RECONFIGURE_STARTED'
  | 'MFA_ENABLED'
  | 'MFA_RECONFIGURED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'MFA_VERIFICATION_FAILED'
  | 'SETTINGS_UPDATED'
  | 'DNS_HEALTH_CHECKED'
  | 'NOTIFICATIONS_VIEWED'

export async function logAudit(params: {
  action: AuditAction
  actorEmail: string
  targetType: 'USER' | 'GROUP' | 'SERVER' | 'SYNC' | 'ADMIN_USER' | 'ACCESS_REQUEST'
  targetId: string
  userId?: string
  details?: Record<string, unknown>
}) {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      actorEmail: params.actorEmail,
      targetType: params.targetType,
      targetId: params.targetId,
      userId: params.userId,
      details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined,
    },
  })
}
