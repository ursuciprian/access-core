import { getTransport } from './index'
import { TransportType } from '@prisma/client'

const { SsmTransportMock, SshTransportMock, AgentTransportMock } = vi.hoisted(() => ({
  SsmTransportMock: vi.fn(),
  SshTransportMock: vi.fn(),
  AgentTransportMock: vi.fn(),
}))

vi.mock('./ssm-transport', () => ({
  SsmTransport: SsmTransportMock,
}))

vi.mock('./ssh-transport', () => ({
  SshTransport: SshTransportMock,
}))

vi.mock('./agent-transport', () => ({
  AgentTransport: AgentTransportMock,
}))


function baseServer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'server-1',
    name: 'test-server',
    transport: TransportType.SSM,
    instanceId: null,
    region: null,
    sshHost: null,
    sshPort: null,
    sshUser: null,
    sshKeySecretId: null,
    agentUrl: null,
    agentApiKeySecretId: null,
    ...overrides,
  } as never
}

describe('getTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ALLOW_SSH_PASSWORD_AUTH
    delete process.env['SSH_KEY_my-secret']
    delete process.env['SSH_PASS_my-secret']
  })

  describe('SSM transport', () => {
    it('returns an SsmTransport instance when transport is SSM', () => {
      const server = baseServer({
        transport: TransportType.SSM,
        instanceId: 'i-0123456789abcdef0',
        region: 'us-east-1',
      })

      getTransport(server)
      expect(SsmTransportMock).toHaveBeenCalledWith('i-0123456789abcdef0', 'us-east-1')
    })

    it('throws when instanceId is missing', () => {
      const server = baseServer({ transport: TransportType.SSM, region: 'us-east-1' })
      expect(() => getTransport(server)).toThrow('SSM transport requires instanceId and region')
    })

    it('throws when region is missing', () => {
      const server = baseServer({ transport: TransportType.SSM, instanceId: 'i-abc' })
      expect(() => getTransport(server)).toThrow('SSM transport requires instanceId and region')
    })
  })

  describe('SSH transport', () => {
    it('returns an SshTransport instance when transport is SSH', () => {
      process.env['SSH_KEY_my-secret'] = 'fake-private-key'
      const server = baseServer({
        transport: TransportType.SSH,
        sshHost: '10.0.0.1',
        sshPort: 22,
        sshUser: 'ubuntu',
        sshKeySecretId: 'my-secret',
      })

      getTransport(server)
      expect(SshTransportMock).toHaveBeenCalledWith('10.0.0.1', 22, 'ubuntu', expect.any(String), undefined)
      delete process.env['SSH_KEY_my-secret']
    })

    it('uses default port 22 when sshPort is null', () => {
      process.env['SSH_KEY_my-secret'] = 'fake-private-key'
      const server = baseServer({
        transport: TransportType.SSH,
        sshHost: '10.0.0.1',
        sshPort: null,
        sshUser: 'ubuntu',
        sshKeySecretId: 'my-secret',
      })

      getTransport(server)
      expect(SshTransportMock).toHaveBeenCalledWith('10.0.0.1', 22, 'ubuntu', expect.any(String), undefined)
    })

    it('throws when no private key is configured and password auth is not explicitly enabled', () => {
      process.env['SSH_PASS_my-secret'] = 'openvpn'
      const server = baseServer({
        transport: TransportType.SSH,
        sshHost: '10.0.0.1',
        sshPort: 22,
        sshUser: 'ubuntu',
        sshKeySecretId: 'my-secret',
      })

      expect(() => getTransport(server)).toThrow(
        'SSH transport requires a private key or explicitly enabled password auth'
      )
    })

    it('allows password auth only when explicitly enabled', () => {
      process.env.ALLOW_SSH_PASSWORD_AUTH = 'true'
      process.env['SSH_PASS_my-secret'] = 'openvpn'
      const server = baseServer({
        transport: TransportType.SSH,
        sshHost: '10.0.0.1',
        sshPort: 22,
        sshUser: 'ubuntu',
        sshKeySecretId: 'my-secret',
      })

      getTransport(server)
      expect(SshTransportMock).toHaveBeenCalledWith('10.0.0.1', 22, 'ubuntu', '', 'openvpn')
    })

    it('throws when sshHost is missing', () => {
      const server = baseServer({
        transport: TransportType.SSH,
        sshUser: 'ubuntu',
        sshKeySecretId: 'my-secret',
      })
      expect(() => getTransport(server)).toThrow('SSH transport requires sshHost, sshUser, and sshKeySecretId')
    })

    it('throws when sshUser is missing', () => {
      const server = baseServer({
        transport: TransportType.SSH,
        sshHost: '10.0.0.1',
        sshKeySecretId: 'my-secret',
      })
      expect(() => getTransport(server)).toThrow('SSH transport requires sshHost, sshUser, and sshKeySecretId')
    })
  })

  describe('AGENT transport', () => {
    it('returns an AgentTransport instance when transport is AGENT', () => {
      process.env['AGENT_KEY_my-agent-key'] = 'agent-api-key'
      const server = baseServer({
        transport: TransportType.AGENT,
        agentUrl: 'https://agent.example.com',
        agentApiKeySecretId: 'my-agent-key',
      })

      getTransport(server)
      expect(AgentTransportMock).toHaveBeenCalledWith('https://agent.example.com', expect.any(String))
      delete process.env['AGENT_KEY_my-agent-key']
    })

    it('throws when agentUrl is missing', () => {
      const server = baseServer({
        transport: TransportType.AGENT,
        agentApiKeySecretId: 'my-agent-key',
      })
      expect(() => getTransport(server)).toThrow('Agent transport requires agentUrl and agentApiKeySecretId')
    })

    it('throws when agentApiKeySecretId is missing', () => {
      const server = baseServer({
        transport: TransportType.AGENT,
        agentUrl: 'https://agent.example.com',
      })
      expect(() => getTransport(server)).toThrow('Agent transport requires agentUrl and agentApiKeySecretId')
    })
  })

  describe('unknown transport', () => {
    it('throws for an unknown transport type', () => {
      const server = baseServer({ transport: 'UNKNOWN' as TransportType })
      expect(() => getTransport(server)).toThrow('Unknown transport type: UNKNOWN')
    })
  })
})
