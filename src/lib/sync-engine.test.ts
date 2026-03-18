import { vi, beforeEach, describe, it, expect } from 'vitest'
import { SyncStatus, SyncType, MembershipSource } from '@prisma/client'

// Mock prisma using the relative import path used by sync-engine.ts
vi.mock('./prisma', () => ({
  prisma: {
    syncJob: {
      create: vi.fn(),
      update: vi.fn(),
    },
    googleGroupMapping: {
      findMany: vi.fn(),
    },
    vpnUserGroup: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    vpnUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('./google-workspace', () => ({
  listGoogleGroupMembers: vi.fn(),
}))

import { runGoogleSync } from './sync-engine'
import { prisma } from './prisma'
import { listGoogleGroupMembers } from './google-workspace'

const mockPrisma = prisma as unknown as {
  syncJob: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  googleGroupMapping: { findMany: ReturnType<typeof vi.fn> }
  vpnUserGroup: { findMany: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> }
  vpnUser: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
}

const mockListGoogleGroupMembers = listGoogleGroupMembers as ReturnType<typeof vi.fn>

const SYNC_JOB_ID = 'job-1'
const SERVER_ID = 'server-1'
const TRIGGERED_BY = 'admin@example.com'

function makeMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mapping-1',
    googleGroupEmail: 'eng@example.com',
    vpnGroupId: 'vpngroup-1',
    vpnGroup: { id: 'vpngroup-1', name: 'Engineering', serverId: SERVER_ID },
    ...overrides,
  }
}

function makeSyncJob(status = SyncStatus.IN_PROGRESS) {
  return { id: SYNC_JOB_ID, status }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.syncJob.create.mockResolvedValue(makeSyncJob(SyncStatus.IN_PROGRESS))
  mockPrisma.syncJob.update.mockResolvedValue(makeSyncJob(SyncStatus.SUCCESS))
  mockPrisma.googleGroupMapping.findMany.mockResolvedValue([])
  mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])
  mockPrisma.vpnUserGroup.upsert.mockResolvedValue({})
  mockPrisma.vpnUser.findUnique.mockResolvedValue(null)
  mockPrisma.vpnUser.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com', commonName: 'new' })
  mockPrisma.vpnUser.update.mockResolvedValue({})
  mockListGoogleGroupMembers.mockResolvedValue([])
})

describe('runGoogleSync', () => {
  it('creates a SyncJob with IN_PROGRESS status at the start', async () => {
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([])

    await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SyncType.GOOGLE_SYNC,
        status: SyncStatus.IN_PROGRESS,
        serverId: SERVER_ID,
        triggeredBy: TRIGGERED_BY,
        startedAt: expect.any(Date),
      }),
    })
  })

  it('marks SyncJob as SUCCESS on completion', async () => {
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([])

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SYNC_JOB_ID },
        data: expect.objectContaining({ status: SyncStatus.SUCCESS, completedAt: expect.any(Date) }),
      })
    )
    expect(result.syncJobId).toBe(SYNC_JOB_ID)
    expect(result.serverId).toBe(SERVER_ID)
  })

  it('creates new VpnUser and adds to group for new Google members', async () => {
    const mapping = makeMapping()
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping])
    mockListGoogleGroupMembers.mockResolvedValue([
      { email: 'new@example.com', id: 'm1', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
    ])
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])
    // User does not exist yet
    mockPrisma.vpnUser.findUnique.mockResolvedValue(null)
    mockPrisma.vpnUser.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com', commonName: 'new' })

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.vpnUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@example.com',
        serverId: SERVER_ID,
      }),
    })
    expect(mockPrisma.vpnUserGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: MembershipSource.GOOGLE_SYNC }),
        update: expect.objectContaining({ source: MembershipSource.GOOGLE_SYNC }),
      })
    )
    expect(result.usersAdded).toBe(1)
  })

  it('does not create duplicate VpnUser if one already exists', async () => {
    const mapping = makeMapping()
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping])
    mockListGoogleGroupMembers.mockResolvedValue([
      { email: 'existing@example.com', id: 'm1', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
    ])
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])
    // User already exists
    mockPrisma.vpnUser.findUnique.mockResolvedValue({ id: 'user-existing', email: 'existing@example.com', commonName: 'existing' })

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.vpnUser.create).not.toHaveBeenCalled()
    expect(mockPrisma.vpnUserGroup.upsert).toHaveBeenCalled()
    expect(result.usersAdded).toBe(0)
  })

  it('handles CN collision by appending suffix', async () => {
    const mapping = makeMapping()
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping])
    mockListGoogleGroupMembers.mockResolvedValue([
      { email: 'user@example.com', id: 'm1', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
    ])
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])
    // No user by email
    mockPrisma.vpnUser.findUnique
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce({ id: 'other', commonName: 'user' }) // CN 'user' exists
      .mockResolvedValueOnce(null) // CN 'user_1' free
    mockPrisma.vpnUser.create.mockResolvedValue({ id: 'user-new', email: 'user@example.com', commonName: 'user_1' })

    await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.vpnUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ commonName: 'user_1' }),
    })
  })

  it('flags removed members that are no longer in Google group', async () => {
    const mapping = makeMapping()
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping])
    // Google group is now empty
    mockListGoogleGroupMembers.mockResolvedValue([])
    // DB has one member with GOOGLE_SYNC source
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        groupId: 'vpngroup-1',
        source: MembershipSource.GOOGLE_SYNC,
        user: { id: 'user-1', email: 'removed@example.com' },
      },
    ])

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.vpnUser.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        isFlagged: true,
        flagReason: expect.stringContaining('eng@example.com'),
        flaggedAt: expect.any(Date),
      }),
    })
    expect(result.usersFlagged).toBe(1)
  })

  it('does not flag user who is still in another Google group mapping to same VPN group', async () => {
    const mapping1 = makeMapping({ id: 'mapping-1', googleGroupEmail: 'eng@example.com' })
    const mapping2 = makeMapping({ id: 'mapping-2', googleGroupEmail: 'eng2@example.com' })
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping1, mapping2])

    // mapping1 has no members, mapping2 still has the user
    mockListGoogleGroupMembers
      .mockResolvedValueOnce([]) // mapping1 - user removed
      .mockResolvedValueOnce([
        { email: 'shared@example.com', id: 'm1', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
      ]) // mapping2 - user still present

    // Both mappings share the same vpnGroupId so findMany returns the same membership for both queries
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        groupId: 'vpngroup-1',
        source: MembershipSource.GOOGLE_SYNC,
        user: { id: 'user-1', email: 'shared@example.com' },
      },
    ])

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.vpnUser.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isFlagged: true }) })
    )
    expect(result.usersFlagged).toBe(0)
  })

  it('skips non-USER type members', async () => {
    const mapping = makeMapping()
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping])
    mockListGoogleGroupMembers.mockResolvedValue([
      { email: 'subgroup@example.com', id: 'm1', role: 'MEMBER', type: 'GROUP', status: 'ACTIVE' },
    ])
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.vpnUser.create).not.toHaveBeenCalled()
    expect(result.usersAdded).toBe(0)
  })

  it('skips inactive members', async () => {
    const mapping = makeMapping()
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping])
    mockListGoogleGroupMembers.mockResolvedValue([
      { email: 'suspended@example.com', id: 'm1', role: 'MEMBER', type: 'USER', status: 'SUSPENDED' },
    ])
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(mockPrisma.vpnUser.create).not.toHaveBeenCalled()
    expect(result.usersAdded).toBe(0)
  })

  it('records error and continues when Google API fails for a mapping', async () => {
    const mapping = makeMapping()
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue([mapping])
    mockListGoogleGroupMembers.mockRejectedValue(new Error('API rate limited'))
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('API rate limited')
    // Job still succeeds (errors are soft)
    expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: SyncStatus.SUCCESS }) })
    )
  })

  it('marks SyncJob FAILED and rethrows when prisma.googleGroupMapping.findMany throws', async () => {
    mockPrisma.googleGroupMapping.findMany.mockRejectedValue(new Error('DB connection lost'))

    await expect(runGoogleSync(SERVER_ID, TRIGGERED_BY)).rejects.toThrow('DB connection lost')

    expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SYNC_JOB_ID },
        data: expect.objectContaining({ status: SyncStatus.FAILED, error: 'DB connection lost' }),
      })
    )
  })

  it('returns correct mappingsProcessed count', async () => {
    const mappings = [
      makeMapping({ id: 'mapping-1', googleGroupEmail: 'a@example.com' }),
      makeMapping({ id: 'mapping-2', googleGroupEmail: 'b@example.com' }),
    ]
    mockPrisma.googleGroupMapping.findMany.mockResolvedValue(mappings)
    mockListGoogleGroupMembers.mockResolvedValue([])
    mockPrisma.vpnUserGroup.findMany.mockResolvedValue([])

    const result = await runGoogleSync(SERVER_ID, TRIGGERED_BY)

    expect(result.mappingsProcessed).toBe(2)
  })
})
