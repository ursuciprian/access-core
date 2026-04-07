import { getTransport } from './transport'
import { validateCommonName, validateServerPaths } from './validation'

type CertificateServer = Parameters<typeof getTransport>[0] & {
  ccdPath: string
  easyRsaPath: string
  serverConf: string
  clientCertValidityDays?: number | null
}

type RevokeCertOptions = {
  allowMissing?: boolean
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildClientArtifactCleanupCommand(commonName: string) {
  const escapedCommonName = shellEscape(commonName)

  return [
    `rm -f pki/reqs/${escapedCommonName}.req`,
    `rm -f pki/private/${escapedCommonName}.key`,
    `rm -f pki/issued/${escapedCommonName}.crt`,
    `rm -f pki/inline/${escapedCommonName}.inline`,
  ].join(' && ')
}

function formatCommandFailure(message: string, stderr: string) {
  const detail = stderr.trim()
  return detail.length > 0 ? `${message}: ${detail}` : message
}

function isMissingCertificateRevokeError(stderr: string) {
  return /unable to revoke as no certificate was found/i.test(stderr)
}

function parseCertificateExpiry(stdout: string) {
  const patterns = [
    /Certificate is to be certified until\s+(.+?)\s+\(\d+\s+days\)/i,
    /Not After\s*:?\s*(.+)/i,
    /notAfter=(.+)/i,
  ]

  for (const pattern of patterns) {
    const match = stdout.match(pattern)
    const rawValue = match?.[1]?.trim()
    if (!rawValue) continue

    const parsedDate = new Date(rawValue)
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate
    }
  }

  return null
}

function assertProvisioningInputs(server: CertificateServer, commonName: string) {
  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    throw new Error('Invalid common name for certificate operation')
  }

  const pathValidation = validateServerPaths({
    ccdPath: server.ccdPath,
    easyRsaPath: server.easyRsaPath,
    serverConf: server.serverConf,
  })
  if (!pathValidation.success) {
    throw new Error('Invalid server paths for certificate operation')
  }
}

export async function generateCert(server: CertificateServer, commonName: string) {
  assertProvisioningInputs(server, commonName)
  const transport = getTransport(server)
  const validityDays = Number.isInteger(server.clientCertValidityDays) && server.clientCertValidityDays > 0
    ? server.clientCertValidityDays
    : 825
  const command = [
    `cd ${shellEscape(server.easyRsaPath)}`,
    buildClientArtifactCleanupCommand(commonName),
    `./easyrsa --batch --days=${validityDays} build-client-full ${shellEscape(commonName)} nopass`,
  ].join(' && ')
  const result = await transport.executeCommand(command)
  if (result.exitCode !== 0) {
    throw new Error(formatCommandFailure('Certificate generation command failed', result.stderr))
  }
  return result
}

export async function inspectCert(server: CertificateServer, commonName: string) {
  assertProvisioningInputs(server, commonName)
  const transport = getTransport(server)
  const command = `cd ${shellEscape(server.easyRsaPath)} && ./easyrsa show-cert ${shellEscape(commonName)} 2>/dev/null || echo "NOT_FOUND"`
  return transport.executeCommand(command)
}

export async function getCertExpiryDate(server: CertificateServer, commonName: string) {
  const result = await inspectCert(server, commonName)
  if (result.stdout.includes('NOT_FOUND')) {
    return null
  }

  return parseCertificateExpiry(result.stdout)
}

export async function revokeCert(server: CertificateServer, commonName: string, options: RevokeCertOptions = {}) {
  assertProvisioningInputs(server, commonName)
  const transport = getTransport(server)
  const command = [
    `cd ${shellEscape(server.easyRsaPath)}`,
    `./easyrsa --batch revoke ${shellEscape(commonName)}`,
    `./easyrsa gen-crl`,
    `cp pki/crl.pem /etc/openvpn/crl.pem`,
    `chmod 644 /etc/openvpn/crl.pem`,
    `(command -v systemctl >/dev/null 2>&1 && (systemctl reload openvpn@server || systemctl reload openvpn)) || (command -v service >/dev/null 2>&1 && service openvpn restart) || true`,
  ].join(' && ')
  const result = await transport.executeCommand(command)
  if (result.exitCode !== 0) {
    if (options.allowMissing && isMissingCertificateRevokeError(result.stderr)) {
      return result
    }
    throw new Error(formatCommandFailure('Certificate revocation command failed', result.stderr))
  }
  return result
}

export async function checkCertStatus(server: CertificateServer, commonName: string) {
  const result = await inspectCert(server, commonName)
  return !result.stdout.includes('NOT_FOUND')
}

export async function isCertRevokedOrMissing(server: CertificateServer, commonName: string) {
  const result = await inspectCert(server, commonName)
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return output.includes('not_found') || output.includes('revoked')
}
