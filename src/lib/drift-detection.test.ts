import { vi, beforeEach, describe, it, expect } from 'vitest'

vi.mock('./transport', () => ({
  getTransport: vi.fn().mockReturnValue({
    executeCommand: vi.fn(),
    testConnectivity: vi.fn(),
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vpnServer: { findUnique: vi.fn() },
    vpnUser: { findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('./ccd-generator', () => ({
  generateCcdForUser: vi.fn(),
  buildCcdWriteCommand: vi.fn(),
}))

vi.mock('./audit', () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}))

vi.mock('./temporary-access', () => ({
  reconcileExpiredTemporaryAccess: vi.fn().mockResolvedValue({ expiredCount: 0, failedCount: 0 }),
}))

import { detectDrift, reconcileDrift } from './drift-detection'
import { getTransport } from './transport'
import { prisma } from '@/lib/prisma'
import { generateCcdForUser } from './ccd-generator'
import { logAudit } from './audit'
import { buildCcdWriteCommand } from './ccd-generator'
import { reconcileExpiredTemporaryAccess } from './temporary-access'

const mockGetTransport = getTransport as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  vpnServer: { findUnique: ReturnType<typeof vi.fn> }
  vpnUser: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  auditLog: { create: ReturnType<typeof vi.fn> }
}
const mockGenerateCcdForUser = generateCcdForUser as ReturnType<typeof vi.fn>
const mockBuildCcdWriteCommand = buildCcdWriteCommand as ReturnType<typeof vi.fn>
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>
const mockReconcileExpiredTemporaryAccess = reconcileExpiredTemporaryAccess as ReturnType<typeof vi.fn>

const SERVER_ID = 'server-1'
const mockServer = {
  id: SERVER_ID,
  name: 'Test Server',
  ccdPath: '/etc/openvpn/ccd',
  easyRsaPath: '/etc/easyrsa',
  transport: 'SSH',
}

function makeTransport() {
  return { executeCommand: vi.fn(), testConnectivity: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.vpnServer.findUnique.mockResolvedValue(mockServer)
  mockPrisma.vpnUser.findMany.mockResolvedValue([])
  mockPrisma.vpnUser.update.mockResolvedValue({})
  mockPrisma.auditLog.create.mockResolvedValue({})
  mockGenerateCcdForUser.mockResolvedValue('')
  mockBuildCcdWriteCommand.mockReturnValue('write-ccd')
  mockReconcileExpiredTemporaryAccess.mockResolvedValue({ expiredCount: 0, failedCount: 0 })
})

describe('detectDrift', () => {
  it('throws if server not found', async () => {
    mockPrisma.vpnServer.findUnique.mockResolvedValue(null)

    await expect(detectDrift('nonexistent')).rejects.toThrow('Server not found: nonexistent')
    expect(mockReconcileExpiredTemporaryAccess).toHaveBeenCalledWith({ serverId: 'nonexistent' })
  })

  it('returns empty results when everything matches', async () => {
    const transport = makeTransport()
    const ccdContent = `push "route 10.0.1.0 255.255.255.0"`
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 0, stdout: ccdContent, stderr: '' }) // cat alice
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([{ id: 'u1', commonName: 'alice' }])
    mockGenerateCcdForUser.mockResolvedValue(ccdContent)

    const result = await detectDrift(SERVER_ID)

    expect(mockReconcileExpiredTemporaryAccess).toHaveBeenCalledWith({ serverId: SERVER_ID })
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it('identifies missing CCD files (in DB but not on server)', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // ls - empty
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([
      { id: 'u1', commonName: 'alice' },
      { id: 'u2', commonName: 'bob' },
    ])

    const result = await detectDrift(SERVER_ID)

    expect(result.missing).toContain('alice')
    expect(result.missing).toContain('bob')
    expect(result.extra).toHaveLength(0)
  })

  it('identifies extra CCD files (on server but not in DB)', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValueOnce({ exitCode: 0, stdout: 'ghost\norphan\n', stderr: '' }) // ls
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([]) // DB is empty

    const result = await detectDrift(SERVER_ID)

    expect(result.extra).toContain('ghost')
    expect(result.extra).toContain('orphan')
    expect(result.missing).toHaveLength(0)
  })

  it('identifies mismatched CCD content', async () => {
    const transport = makeTransport()
    const actualContent = `push "route 10.0.1.0 255.255.255.0"`
    const expectedContent = `push "route 192.168.1.0 255.255.255.0"`
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 0, stdout: actualContent, stderr: '' }) // cat alice
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([{ id: 'u1', commonName: 'alice' }])
    mockGenerateCcdForUser.mockResolvedValue(expectedContent)

    const result = await detectDrift(SERVER_ID)

    expect(result.mismatched).toHaveLength(1)
    expect(result.mismatched[0].cn).toBe('alice')
    expect(result.mismatched[0].expected).toBe(expectedContent)
    expect(result.mismatched[0].actual).toBe(actualContent)
  })

  it('treats files not matching CCD path on server as extra', async () => {
    const transport = makeTransport()
    // ls returns alice (in DB) and zombie (not in DB)
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\nzombie\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'push "route 10.0.0.0 255.0.0.0"', stderr: '' }) // cat alice
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([{ id: 'u1', commonName: 'alice' }])
    mockGenerateCcdForUser.mockResolvedValue('push "route 10.0.0.0 255.0.0.0"')

    const result = await detectDrift(SERVER_ID)

    expect(result.extra).toContain('zombie')
    expect(result.missing).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it('handles failed ls command gracefully (treats server files as empty)', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'Permission denied' }) // ls fails
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([{ id: 'u1', commonName: 'alice' }])

    const result = await detectDrift(SERVER_ID)

    // All DB users become "missing" since server has no files
    expect(result.missing).toContain('alice')
    expect(result.extra).toHaveLength(0)
  })

  it('normalizes CCD content for comparison (whitespace insensitive)', async () => {
    const transport = makeTransport()
    // actual has trailing spaces and different line order
    const actualContent = `  push "route 192.168.1.0 255.255.255.0"  \npush "route 10.0.1.0 255.255.255.0"\n`
    const expectedContent = `push "route 10.0.1.0 255.255.255.0"\npush "route 192.168.1.0 255.255.255.0"`
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 0, stdout: actualContent, stderr: '' }) // cat alice
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([{ id: 'u1', commonName: 'alice' }])
    mockGenerateCcdForUser.mockResolvedValue(expectedContent)

    const result = await detectDrift(SERVER_ID)

    // Normalized content should match, so no mismatches
    expect(result.mismatched).toHaveLength(0)
  })

  it('ignores invalid common names returned by ls on server', async () => {
    const transport = makeTransport()
    // ls returns a path traversal attempt — should be filtered out
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '../etc/passwd\nalice\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // cat alice
    mockGetTransport.mockReturnValue(transport)

    mockPrisma.vpnUser.findMany.mockResolvedValue([{ id: 'u1', commonName: 'alice' }])
    mockGenerateCcdForUser.mockResolvedValue('')

    const result = await detectDrift(SERVER_ID)

    expect(result.extra).not.toContain('../etc/passwd')
  })
})

describe('reconcileDrift', () => {
  it('reconciles expired temporary access before pushing CCD updates', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    mockGetTransport.mockReturnValue(transport)
    mockPrisma.vpnUser.findMany.mockResolvedValue([{ id: 'u1', commonName: 'alice' }])
    mockGenerateCcdForUser.mockResolvedValue('push "route 10.0.1.0 255.255.255.0"')

    await reconcileDrift(SERVER_ID, 'admin@example.com')

    expect(mockReconcileExpiredTemporaryAccess).toHaveBeenCalledWith({ serverId: SERVER_ID })
    expect(mockBuildCcdWriteCommand).toHaveBeenCalledWith(
      mockServer.ccdPath,
      'alice',
      'push "route 10.0.1.0 255.255.255.0"'
    )
    expect(mockPrisma.vpnUser.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ ccdSyncStatus: 'SUCCESS' }),
    })
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CCD_PUSHED',
        actorEmail: 'admin@example.com',
        targetId: SERVER_ID,
      })
    )
  })
})
