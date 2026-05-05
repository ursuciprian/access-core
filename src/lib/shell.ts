import { validateCommonName, validateServerPaths } from './validation'

export function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildCatCommand(path: string) {
  return `cat ${shellEscape(path)}`
}

export function buildListDirectoryCommand(path: string) {
  const pathValidation = validateServerPaths({
    ccdPath: path,
    easyRsaPath: '/tmp',
    serverConf: '/tmp/server.conf',
  })
  if (!pathValidation.success) {
    throw new Error('Invalid directory path for shell command')
  }

  return `ls -1 ${shellEscape(path)}/`
}

export function buildReadCcdCommand(ccdPath: string, commonName: string) {
  const pathValidation = validateServerPaths({
    ccdPath,
    easyRsaPath: '/tmp',
    serverConf: '/tmp/server.conf',
  })
  if (!pathValidation.success) {
    throw new Error('Invalid CCD path for shell command')
  }

  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    throw new Error('Invalid common name for CCD read command')
  }

  return buildCatCommand(`${ccdPath}/${commonName}`)
}

export function buildRemoveFileCommand(path: string) {
  return `rm -f ${shellEscape(path)}`
}

export function buildShowCertCommand(easyRsaPath: string, commonName: string) {
  const pathValidation = validateServerPaths({
    ccdPath: '/tmp',
    easyRsaPath,
    serverConf: '/tmp/server.conf',
  })
  if (!pathValidation.success) {
    throw new Error('Invalid Easy-RSA path for shell command')
  }

  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    throw new Error('Invalid common name for certificate command')
  }

  return `cd ${shellEscape(easyRsaPath)} && ./easyrsa show-cert ${shellEscape(commonName)} 2>/dev/null || echo "NOT_FOUND"`
}

export function buildOpenVpnKillCommand(commonName: string) {
  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    throw new Error('Invalid common name for OpenVPN management command')
  }

  return `printf '%s\\n' ${shellEscape(`kill ${commonName}`)} | nc -w 1 127.0.0.1 7505 2>/dev/null || true`
}
