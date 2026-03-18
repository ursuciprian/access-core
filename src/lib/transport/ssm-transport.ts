import {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
} from '@aws-sdk/client-ssm'
import { TransportProvider, CommandResult } from './types'

export class SsmTransport implements TransportProvider {
  private client: SSMClient
  private instanceId: string

  constructor(instanceId: string, region: string) {
    this.client = new SSMClient({ region })
    this.instanceId = instanceId
  }

  async executeCommand(command: string, timeoutMs = 60000): Promise<CommandResult> {
    const sendResult = await this.client.send(
      new SendCommandCommand({
        InstanceIds: [this.instanceId],
        DocumentName: 'AWS-RunShellScript',
        Parameters: { commands: [command] },
        TimeoutSeconds: Math.ceil(timeoutMs / 1000),
      })
    )

    const commandId = sendResult.Command?.CommandId
    if (!commandId) {
      throw new Error('SSM SendCommand did not return a CommandId')
    }

    // Poll for completion
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      try {
        const invocation = await this.client.send(
          new GetCommandInvocationCommand({
            CommandId: commandId,
            InstanceId: this.instanceId,
          })
        )

        if (invocation.Status === 'Success') {
          return {
            exitCode: 0,
            stdout: invocation.StandardOutputContent ?? '',
            stderr: invocation.StandardErrorContent ?? '',
          }
        }

        if (invocation.Status === 'Failed' || invocation.Status === 'Cancelled' || invocation.Status === 'TimedOut') {
          return {
            exitCode: invocation.ResponseCode ?? 1,
            stdout: invocation.StandardOutputContent ?? '',
            stderr: invocation.StandardErrorContent ?? '',
          }
        }
      } catch {
        // InvocationDoesNotExist — command still pending
      }
    }

    throw new Error(`SSM command timed out after ${timeoutMs}ms`)
  }

  async testConnectivity(): Promise<boolean> {
    try {
      const result = await this.executeCommand('echo ok', 15000)
      return result.exitCode === 0 && result.stdout.trim() === 'ok'
    } catch {
      return false
    }
  }
}
