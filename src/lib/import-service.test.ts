import { vi, beforeEach, describe, it, expect } from 'vitest'
import { CertStatus } from '@prisma/client'

vi.mock('./transport', () => ({
  getTransport: vi.fn().mockReturnValue({
    executeCommand: vi.fn(),
    testConnectivity: vi.fn(),
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vpnServer: { findUnique: vi.fn() },
    vpnGroup: { findMany: vi.fn() },
    vpnUser: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('./audit', () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}))

import { discoverExistingUsers, importUsers } from './import-service'
import { getTransport } from './transport'
import { prisma } from '@/lib/prisma'
import { logAudit } from './audit'

const mockGetTransport = getTransport as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  vpnServer: { findUnique: ReturnType<typeof vi.fn> }
  vpnGroup: { findMany: ReturnType<typeof vi.fn> }
  vpnUser: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  auditLog: { create: ReturnType<typeof vi.fn> }
}
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>

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
  mockPrisma.vpnGroup.findMany.mockResolvedValue([])
  mockPrisma.vpnUser.findMany.mockResolvedValue([])
  mockPrisma.vpnUser.create.mockResolvedValue({ id: 'user-1', email: 'alice@example.com', commonName: 'alice' })
  mockPrisma.auditLog.create.mockResolvedValue({})
})

describe('discoverExistingUsers', () => {
  it('throws if server not found', async () => {
    mockPrisma.vpnServer.findUnique.mockResolvedValue(null)

    await expect(discoverExistingUsers('nonexistent')).rejects.toThrow('Server not found: nonexistent')
  })

  it('throws if ls command fails', async () => {
    const transport = makeTransport()
    transport.executeCommand.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'Permission denied' })
    mockGetTransport.mockReturnValue(transport)

    await expect(discoverExistingUsers(SERVER_ID)).rejects.toThrow('Failed to list CCD directory')
  })

  it('parses ls output to get CN list', async () => {
    const transport = makeTransport()
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\nbob\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // cat alice CCD
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'ACTIVE cert info', stderr: '' }) // easyrsa alice
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // cat bob CCD
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'ACTIVE cert info', stderr: '' }) // easyrsa bob
    mockGetTransport.mockReturnValue(transport)

    const result = await discoverExistingUsers(SERVER_ID)

    expect(result).toHaveLength(2)
    expect(result.map((u) => u.commonName)).toEqual(['alice', 'bob'])
  })

  it('filters out invalid common names from ls output', async () => {
    const transport = makeTransport()
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'valid-cn\n../evil\nok_user\n', stderr: '' }) // ls
      // valid-cn
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'ACTIVE', stderr: '' })
      // ok_user
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'ACTIVE', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const result = await discoverExistingUsers(SERVER_ID)

    expect(result.map((u) => u.commonName)).not.toContain('../evil')
    expect(result).toHaveLength(2)
  })

  it('skips users that already exist in the portal for the same server', async () => {
    const transport = makeTransport()
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\nbob\n', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'ACTIVE cert info', stderr: '' })
    mockGetTransport.mockReturnValue(transport)
    mockPrisma.vpnUser.findMany.mockResolvedValue([{ commonName: 'alice' }])

    const result = await discoverExistingUsers(SERVER_ID)

    expect(mockPrisma.vpnUser.findMany).toHaveBeenCalledWith({
      where: { serverId: SERVER_ID, commonName: { in: ['alice', 'bob'] } },
      select: { commonName: true },
    })
    expect(result.map((u) => u.commonName)).toEqual(['bob'])
  })

  it('reads CCD files and parses route lines', async () => {
    const transport = makeTransport()
    const ccdContent = `push "route 10.0.1.0 255.255.255.0"\npush "route 192.168.0.0 255.255.0.0"\n`
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 0, stdout: ccdContent, stderr: '' }) // cat CCD
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'ACTIVE cert', stderr: '' }) // easyrsa
    mockGetTransport.mockReturnValue(transport)

    const result = await discoverExistingUsers(SERVER_ID)

    expect(result[0].routes).toEqual(['10.0.1.0/255.255.255.0', '192.168.0.0/255.255.0.0'])
  })

  it('returns empty routes when CCD cat fails', async () => {
    const transport = makeTransport()
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' }) // ls
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'No such file' }) // cat CCD fails
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'ACTIVE cert', stderr: '' }) // easyrsa
    mockGetTransport.mockReturnValue(transport)

    const result = await discoverExistingUsers(SERVER_ID)

    expect(result[0].routes).toEqual([])
  })

  it('checks cert status for each CN — ACTIVE', async () => {
    const transport = makeTransport()
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'Valid certificate info\nsubject=CN=alice', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const result = await discoverExistingUsers(SERVER_ID)

    expect(result[0].certStatus).toBe('ACTIVE')
  })

  it('checks cert status for each CN — REVOKED', async () => {
    const transport = makeTransport()
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'Certificate is revoked', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const result = await discoverExistingUsers(SERVER_ID)

    expect(result[0].certStatus).toBe('REVOKED')
  })

  it('checks cert status for each CN — NONE when NOT_FOUND', async () => {
    const transport = makeTransport()
    transport.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'alice\n', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'NOT_FOUND', stderr: '' })
    mockGetTransport.mockReturnValue(transport)

    const result = await discoverExistingUsers(SERVER_ID)

    expect(result[0].certStatus).toBe('NONE')
  })
})

describe('importUsers', () => {
  it('throws if server not found', async () => {
    mockPrisma.vpnServer.findUnique.mockResolvedValue(null)

    await expect(importUsers('nonexistent', [], 'admin@example.com')).rejects.toThrow('Server not found')
  })

  it('creates VpnUser records with correct fields', async () => {
    mockPrisma.vpnGroup.findMany.mockResolvedValue([{ id: 'grp-1' }])
    mockPrisma.vpnUser.create.mockResolvedValue({ id: 'u1', email: 'alice@example.com', commonName: 'alice' })

    const result = await importUsers(
      SERVER_ID,
      [{ commonName: 'alice', email: 'alice@example.com', groupIds: ['grp-1'] }],
      'admin@example.com'
    )

    expect(mockPrisma.vpnUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'alice@example.com',
        commonName: 'alice',
        serverId: SERVER_ID,
        certStatus: CertStatus.NONE,
        isEnabled: true,
      }),
    })
    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('assigns users to groups', async () => {
    mockPrisma.vpnGroup.findMany.mockResolvedValue([{ id: 'grp-1' }, { id: 'grp-2' }])
    mockPrisma.vpnUser.create.mockResolvedValue({ id: 'u1', email: 'alice@example.com', commonName: 'alice' })

    await importUsers(
      SERVER_ID,
      [{ commonName: 'alice', email: 'alice@example.com', groupIds: ['grp-1', 'grp-2'] }],
      'admin@example.com'
    )

    expect(mockPrisma.vpnUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groups: {
          create: expect.arrayContaining([
            expect.objectContaining({ groupId: 'grp-1', source: 'MANUAL' }),
            expect.objectContaining({ groupId: 'grp-2', source: 'MANUAL' }),
          ]),
        },
      }),
    })
  })

  it('creates audit log entries for each imported user', async () => {
    mockPrisma.vpnGroup.findMany.mockResolvedValue([])
    mockPrisma.vpnUser.create.mockResolvedValue({ id: 'u1', email: 'alice@example.com', commonName: 'alice' })

    await importUsers(
      SERVER_ID,
      [{ commonName: 'alice', email: 'alice@example.com', groupIds: [] }],
      'admin@example.com'
    )

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_COMPLETED',
        actorEmail: 'admin@example.com',
        targetType: 'USER',
      })
    )
  })

  it('returns error summary for invalid common names', async () => {
    const result = await importUsers(
      SERVER_ID,
      [{ commonName: '../evil', email: 'evil@example.com', groupIds: [] }],
      'admin@example.com'
    )

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].cn).toBe('../evil')
    expect(result.errors[0].error).toBe('Invalid common name')
    expect(mockPrisma.vpnUser.create).not.toHaveBeenCalled()
  })

  it('returns error summary for failed prisma creates', async () => {
    mockPrisma.vpnGroup.findMany.mockResolvedValue([])
    mockPrisma.vpnUser.create.mockRejectedValue(new Error('Unique constraint failed'))

    const result = await importUsers(
      SERVER_ID,
      [{ commonName: 'alice', email: 'alice@example.com', groupIds: [] }],
      'admin@example.com'
    )

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].cn).toBe('alice')
  })

  it('imports multiple users and counts correctly', async () => {
    mockPrisma.vpnGroup.findMany.mockResolvedValue([])
    mockPrisma.vpnUser.create
      .mockResolvedValueOnce({ id: 'u1', email: 'alice@example.com', commonName: 'alice' })
      .mockResolvedValueOnce({ id: 'u2', email: 'bob@example.com', commonName: 'bob' })

    const result = await importUsers(
      SERVER_ID,
      [
        { commonName: 'alice', email: 'alice@example.com', groupIds: [] },
        { commonName: 'bob', email: 'bob@example.com', groupIds: [] },
      ],
      'admin@example.com'
    )

    expect(result.imported).toBe(2)
    expect(result.errors).toHaveLength(0)
  })

  it('only assigns groups that belong to the server', async () => {
    // findMany returns only grp-1 (belongs to server), not grp-foreign
    mockPrisma.vpnGroup.findMany.mockResolvedValue([{ id: 'grp-1' }])
    mockPrisma.vpnUser.create.mockResolvedValue({ id: 'u1', email: 'alice@example.com', commonName: 'alice' })

    await importUsers(
      SERVER_ID,
      [{ commonName: 'alice', email: 'alice@example.com', groupIds: ['grp-1', 'grp-foreign'] }],
      'admin@example.com'
    )

    const createCall = mockPrisma.vpnUser.create.mock.calls[0][0]
    expect(createCall.data.groups.create).toHaveLength(1)
    expect(createCall.data.groups.create[0].groupId).toBe('grp-1')
  })
})
