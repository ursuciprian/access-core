import { vi, beforeEach, describe, it, expect } from 'vitest'

vi.mock('./transport', () => ({
  getTransport: vi.fn().mockReturnValue({
    executeCommand: vi.fn(),
    testConnectivity: vi.fn(),
  }),
}))

import { generateCert, revokeCert, checkCertStatus, getCertExpiryDate } from './cert-service'
import { getTransport } from './transport'

const mockGetTransport = getTransport as ReturnType<typeof vi.fn>

function makeServer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'server-1',
    name: 'Test Server',
    easyRsaPath: '/etc/easyrsa',
    clientCertValidityDays: 825,
    ccdPath: '/etc/openvpn/ccd',
    serverConf: '/etc/openvpn/server.conf',
    transport: 'SSH',
    sshHost: 'vpn.example.com',
    sshUser: 'root',
    sshPort: 22,
    sshKeySecretId: 'my-key',
    instanceId: null,
    region: null,
    agentUrl: null,
    agentApiKeySecretId: null,
    ...overrides,
  }
}

function makeTransport() {
  return { executeCommand: vi.fn(), testConnectivity: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateCert', () => {
  it('calls executeCommand with correct easyrsa command', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'Certificate generated', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const server = makeServer()
    await generateCert(server as any, 'alice')

    expect(transport.executeCommand).toHaveBeenCalledWith(
      `cd '/etc/easyrsa' && rm -f pki/reqs/'alice'.req && rm -f pki/private/'alice'.key && rm -f pki/issued/'alice'.crt && rm -f pki/inline/'alice'.inline && ./easyrsa --batch --days=825 build-client-full 'alice' nopass`
    )
  })

  it('uses server easyRsaPath in command', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const server = makeServer({ easyRsaPath: '/custom/pki' })
    await generateCert(server as any, 'bob')

    expect(transport.executeCommand).toHaveBeenCalledWith(
      expect.stringContaining(`cd '/custom/pki'`)
    )
  })

  it('uses server client certificate validity days in the command', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const server = makeServer({ clientCertValidityDays: 90 })
    await generateCert(server as any, 'bob')

    expect(transport.executeCommand).toHaveBeenCalledWith(
      expect.stringContaining('--days=90')
    )
  })

  it('returns command result', async () => {
    const transport = makeTransport()
    const commandResult = { exitCode: 0, stdout: 'Done', stderr: '' }
    transport.executeCommand.mockResolvedValue(commandResult)
    mockGetTransport.mockReturnValue(transport)

    const result = await generateCert(makeServer() as any, 'alice')

    expect(result).toEqual(commandResult)
  })

  it('propagates transport errors', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockRejectedValue(new Error('SSH connection failed'))
    mockGetTransport.mockReturnValue(transport)

    await expect(generateCert(makeServer() as any, 'alice')).rejects.toThrow('SSH connection failed')
  })

  it('throws when the command exits non-zero', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'failure' })
    mockGetTransport.mockReturnValue(transport)

    await expect(generateCert(makeServer() as any, 'alice')).rejects.toThrow(
      'Certificate generation command failed: failure'
    )
  })
})

describe('revokeCert', () => {
  it('calls executeCommand with revoke, gen-crl, cp, chmod, and systemctl reload', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    await revokeCert(makeServer() as any, 'alice')

    const command: string = transport.executeCommand.mock.calls[0][0]
    expect(command).toContain(`./easyrsa --batch revoke 'alice'`)
    expect(command).toContain('./easyrsa gen-crl')
    expect(command).toContain('cp pki/crl.pem /etc/openvpn/crl.pem')
    expect(command).toContain('chmod 644 /etc/openvpn/crl.pem')
    expect(command).toContain('command -v systemctl')
    expect(command).toContain('service openvpn restart')
  })

  it('includes cd to easyRsaPath in revoke command', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const server = makeServer({ easyRsaPath: '/opt/easy-rsa' })
    await revokeCert(server as any, 'bob')

    const command: string = transport.executeCommand.mock.calls[0][0]
    expect(command).toContain(`cd '/opt/easy-rsa'`)
  })

  it('returns command result', async () => {
    const transport = makeTransport()
    const commandResult = { exitCode: 0, stdout: 'Revoked', stderr: '' }
    transport.executeCommand.mockResolvedValue(commandResult)
    mockGetTransport.mockReturnValue(transport)

    const result = await revokeCert(makeServer() as any, 'alice')

    expect(result).toEqual(commandResult)
  })

  it('throws when revoke exits non-zero', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'failure' })
    mockGetTransport.mockReturnValue(transport)

    await expect(revokeCert(makeServer() as any, 'alice')).rejects.toThrow(
      'Certificate revocation command failed: failure'
    )
  })

  it('allows missing certificates when requested', async () => {
    const transport = makeTransport()
    const commandResult = {
      exitCode: 1,
      stdout: '',
      stderr: 'Easy-RSA error:\n\nUnable to revoke as no certificate was found.',
    }
    transport.executeCommand.mockResolvedValue(commandResult)
    mockGetTransport.mockReturnValue(transport)

    const result = await revokeCert(makeServer() as any, 'alice', { allowMissing: true })

    expect(result).toEqual(commandResult)
  })
})

describe('checkCertStatus', () => {
  it('returns true when cert exists (no NOT_FOUND in output)', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'Certificate: alice\nValid', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const result = await checkCertStatus(makeServer() as any, 'alice')

    expect(result).toBe(true)
  })

  it('returns false when output contains NOT_FOUND', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'NOT_FOUND', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const result = await checkCertStatus(makeServer() as any, 'nonexistent')

    expect(result).toBe(false)
  })

  it('uses correct easyrsa show-cert command', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'cert data', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    await checkCertStatus(makeServer() as any, 'alice')

    expect(transport.executeCommand).toHaveBeenCalledWith(
      `cd '/etc/easyrsa' && ./easyrsa show-cert 'alice' 2>/dev/null || echo "NOT_FOUND"`
    )
  })

  it('uses server easyRsaPath in status check command', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'cert data', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const server = makeServer({ easyRsaPath: '/srv/pki' })
    await checkCertStatus(server as any, 'alice')

    expect(transport.executeCommand).toHaveBeenCalledWith(
      expect.stringContaining(`cd '/srv/pki'`)
    )
  })
})

describe('getCertExpiryDate', () => {
  it('parses EasyRSA expiry output', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({
      exitCode: 0,
      stdout: 'Certificate is to be certified until May  6 12:00:00 2026 GMT (30 days)',
      stderr: '',
    })
    mockGetTransport.mockReturnValue(transport)

    const result = await getCertExpiryDate(makeServer() as any, 'alice')

    expect(result?.toISOString()).toBe('2026-05-06T12:00:00.000Z')
  })

  it('returns null when certificate is not found', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'NOT_FOUND', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const result = await getCertExpiryDate(makeServer() as any, 'alice')

    expect(result).toBeNull()
  })
})
