import { Client } from 'ssh2'
import { TransportProvider, CommandResult } from './types'

export class SshTransport implements TransportProvider {
  private host: string
  private port: number
  private username: string
  private privateKey: string
  private password?: string

  constructor(host: string, port: number, username: string, privateKey: string, password?: string) {
    this.host = host
    this.port = port
    this.username = username
    this.privateKey = privateKey
    this.password = password
  }

  async executeCommand(command: string, timeoutMs = 60000): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const conn = new Client()
      const timer = setTimeout(() => {
        conn.end()
        reject(new Error(`SSH command timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer)
            conn.end()
            reject(err)
            return
          }

          let stdout = ''
          let stderr = ''

          stream.on('data', (data: Buffer) => {
            stdout += data.toString()
          })

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })

          stream.on('close', (code: number) => {
            clearTimeout(timer)
            conn.end()
            resolve({ exitCode: code ?? 0, stdout, stderr })
          })
        })
      })

      conn.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })

      const connectConfig: Record<string, unknown> = {
        host: this.host,
        port: this.port,
        username: this.username,
      }
      if (this.privateKey) {
        connectConfig.privateKey = this.privateKey
      } else if (this.password) {
        connectConfig.password = this.password
      }
      conn.connect(connectConfig)
    })
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
