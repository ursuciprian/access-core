import { TransportProvider, CommandResult } from './types'

export class AgentTransport implements TransportProvider {
  private agentUrl: string
  private apiKey: string

  constructor(agentUrl: string, apiKey: string) {
    this.agentUrl = agentUrl.replace(/\/$/, '')
    this.apiKey = apiKey
  }

  async executeCommand(command: string, timeoutMs = 60000): Promise<CommandResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${this.agentUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ command }),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        throw new Error(`Agent returned ${response.status}: ${await response.text()}`)
      }

      const result = await response.json()
      return {
        exitCode: result.exitCode ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      }
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Agent command timed out after ${timeoutMs}ms`)
      }
      throw err
    }
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
