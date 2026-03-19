import { z } from 'zod/v4'

const SERVER_PATH_REGEX = /^\/[a-zA-Z0-9/_.-]+$/
const COMMON_NAME_REGEX = /^[a-zA-Z0-9._-]+$/
export const MIN_PASSWORD_LENGTH = 12

export const serverPathSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(SERVER_PATH_REGEX, 'Path must match /^\\/[a-zA-Z0-9/_.-]+$/')
  .refine((val) => !val.includes('..'), 'Path must not contain ".."')

export const commonNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(COMMON_NAME_REGEX, 'Common name must match /^[a-zA-Z0-9._-]+$/')
  .refine((val) => !val.includes('..'), 'Common name must not contain ".."')

export const cidrSchema = z
  .string()
  .regex(
    /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
    'Must be a valid IPv4 CIDR (e.g., 10.0.1.0/24)'
  )
  .refine((val) => {
    const [ip, prefix] = val.split('/')
    const prefixNum = parseInt(prefix, 10)
    if (prefixNum < 0 || prefixNum > 32) return false
    const octets = ip.split('.').map(Number)
    return octets.every((o) => o >= 0 && o <= 255)
  }, 'Invalid IPv4 CIDR notation')

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`)
  .max(256, 'Password must be at most 256 characters long')

export function validateServerPaths(data: {
  ccdPath: string
  easyRsaPath: string
  serverConf: string
}) {
  return z
    .object({
      ccdPath: serverPathSchema,
      easyRsaPath: serverPathSchema,
      serverConf: serverPathSchema,
    })
    .safeParse(data)
}

export function validateCommonName(cn: string) {
  return commonNameSchema.safeParse(cn)
}

export function validateCidr(cidr: string) {
  return cidrSchema.safeParse(cidr)
}

export function deriveCommonName(email: string): string {
  const prefix = email.split('@')[0]
  // Remove + and everything after it
  const cleaned = prefix.replace(/\+.*$/, '')
  return cleaned
}
