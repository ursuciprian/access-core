import { validateCommonName } from './validation'

export function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildCatCommand(path: string) {
  return `cat ${shellEscape(path)}`
}

export function buildOpenVpnKillCommand(commonName: string) {
  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    throw new Error('Invalid common name for OpenVPN management command')
  }

  return `printf '%s\\n' ${shellEscape(`kill ${commonName}`)} | nc -w 1 127.0.0.1 7505 2>/dev/null || true`
}
