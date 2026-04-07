import { describe, expect, it } from 'vitest'
import { validateAgentUrl } from './agent-url'

describe('validateAgentUrl', () => {
  it('rejects bracketed IPv6 loopback literals', () => {
    expect(validateAgentUrl('https://[::1]:8443').success).toBe(false)
  })

  it('rejects IPv4-mapped IPv6 literals', () => {
    expect(validateAgentUrl('https://[::ffff:169.254.169.254]/').success).toBe(false)
    expect(validateAgentUrl('https://[::ffff:127.0.0.1]/').success).toBe(false)
  })

  it('allows public agent URLs', () => {
    expect(validateAgentUrl('https://agent.example.com').success).toBe(true)
    expect(validateAgentUrl('https://[2606:4700:4700::1111]/').success).toBe(true)
  })
})
