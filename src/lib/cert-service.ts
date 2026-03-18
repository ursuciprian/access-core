import { VpnServer } from '@prisma/client'
import { getTransport } from './transport'
import { validateCommonName, validateServerPaths } from './validation'

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function assertProvisioningInputs(server: VpnServer, commonName: string) {
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

export async function generateCert(server: VpnServer, commonName: string) {
  assertProvisioningInputs(server, commonName)
  const transport = getTransport(server)
  const command = `cd ${shellEscape(server.easyRsaPath)} && ./easyrsa --batch build-client-full ${shellEscape(commonName)} nopass`
  const result = await transport.executeCommand(command)
  if (result.exitCode !== 0) {
    throw new Error('Certificate generation command failed')
  }
  return result
}

export async function inspectCert(server: VpnServer, commonName: string) {
  assertProvisioningInputs(server, commonName)
  const transport = getTransport(server)
  const command = `cd ${shellEscape(server.easyRsaPath)} && ./easyrsa show-cert ${shellEscape(commonName)} 2>/dev/null || echo "NOT_FOUND"`
  return transport.executeCommand(command)
}

export async function revokeCert(server: VpnServer, commonName: string) {
  assertProvisioningInputs(server, commonName)
  const transport = getTransport(server)
  const command = [
    `cd ${shellEscape(server.easyRsaPath)}`,
    `./easyrsa --batch revoke ${shellEscape(commonName)}`,
    `./easyrsa gen-crl`,
    `cp pki/crl.pem /etc/openvpn/crl.pem`,
    `chmod 644 /etc/openvpn/crl.pem`,
    `systemctl reload openvpn@server || systemctl reload openvpn`,
  ].join(' && ')
  const result = await transport.executeCommand(command)
  if (result.exitCode !== 0) {
    throw new Error('Certificate revocation command failed')
  }
  return result
}

export async function checkCertStatus(server: VpnServer, commonName: string) {
  const result = await inspectCert(server, commonName)
  return !result.stdout.includes('NOT_FOUND')
}

export async function isCertRevokedOrMissing(server: VpnServer, commonName: string) {
  const result = await inspectCert(server, commonName)
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return output.includes('not_found') || output.includes('revoked')
}
