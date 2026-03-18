import { VpnServer, TransportType } from '@prisma/client'
import { TransportProvider } from './types'
import { SsmTransport } from './ssm-transport'
import { SshTransport } from './ssh-transport'
import { AgentTransport } from './agent-transport'

export type { TransportProvider, CommandResult } from './types'

function isSshPasswordAuthEnabled() {
  return process.env.ALLOW_SSH_PASSWORD_AUTH === 'true'
}

export function getTransport(server: VpnServer): TransportProvider {
  switch (server.transport) {
    case TransportType.SSM: {
      if (!server.instanceId || !server.region) {
        throw new Error(
          `SSM transport requires instanceId and region for server "${server.name}"`
        )
      }
      return new SsmTransport(server.instanceId, server.region)
    }

    case TransportType.SSH: {
      if (!server.sshHost || !server.sshUser || !server.sshKeySecretId) {
        throw new Error(
          `SSH transport requires sshHost, sshUser, and sshKeySecretId for server "${server.name}"`
        )
      }
      const privateKey = process.env[`SSH_KEY_${server.sshKeySecretId}`] ?? ''
      const password = isSshPasswordAuthEnabled()
        ? process.env[`SSH_PASS_${server.sshKeySecretId}`]
        : undefined

      if (!privateKey && !password) {
        throw new Error(
          `SSH transport requires a private key or explicitly enabled password auth for server "${server.name}"`
        )
      }

      return new SshTransport(
        server.sshHost,
        server.sshPort ?? 22,
        server.sshUser,
        privateKey,
        password
      )
    }

    case TransportType.AGENT: {
      if (!server.agentUrl || !server.agentApiKeySecretId) {
        throw new Error(
          `Agent transport requires agentUrl and agentApiKeySecretId for server "${server.name}"`
        )
      }
      const apiKey = process.env[`AGENT_KEY_${server.agentApiKeySecretId}`] ?? ''
      return new AgentTransport(server.agentUrl, apiKey)
    }

    default:
      throw new Error(`Unknown transport type: ${server.transport}`)
  }
}
