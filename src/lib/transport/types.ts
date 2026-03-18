export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface TransportProvider {
  executeCommand(command: string, timeoutMs?: number): Promise<CommandResult>
  testConnectivity(): Promise<boolean>
}
