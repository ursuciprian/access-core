import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'

const { mockMembersList, mockGroupsList, mockUsersGet, mockAdminInstance } = vi.hoisted(() => {
  const mockMembersList = vi.fn()
  const mockGroupsList = vi.fn()
  const mockUsersGet = vi.fn()
  const mockAdminInstance = {
    members: { list: mockMembersList },
    groups: { list: mockGroupsList },
    users: { get: mockUsersGet },
  }
  return { mockMembersList, mockGroupsList, mockUsersGet, mockAdminInstance }
})

vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        JWT: function() { return {} },
      },
      admin: vi.fn().mockReturnValue(mockAdminInstance),
    },
  }
})

import { listGoogleGroupMembers, listGoogleGroups } from './google-workspace'

const VALID_ENV = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@project.iam.gserviceaccount.com',
  GOOGLE_SERVICE_ACCOUNT_KEY: JSON.stringify({
    private_key: 'not-a-real-private-key-for-tests',
    client_email: 'sa@project.iam.gserviceaccount.com',
  }),
  GOOGLE_ADMIN_EMAIL: 'admin@example.com',
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(process.env, VALID_ENV)
})

afterEach(() => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  delete process.env.GOOGLE_ADMIN_EMAIL
})

describe('listGoogleGroupMembers', () => {
  it('throws when GOOGLE_SERVICE_ACCOUNT_EMAIL is missing', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

    await expect(listGoogleGroupMembers('eng@example.com')).rejects.toThrow(
      'Missing Google Workspace credentials'
    )
  })

  it('throws when GOOGLE_SERVICE_ACCOUNT_KEY is missing', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    await expect(listGoogleGroupMembers('eng@example.com')).rejects.toThrow(
      'Missing Google Workspace credentials'
    )
  })

  it('throws when GOOGLE_ADMIN_EMAIL is missing', async () => {
    delete process.env.GOOGLE_ADMIN_EMAIL

    await expect(listGoogleGroupMembers('eng@example.com')).rejects.toThrow(
      'Missing Google Workspace credentials'
    )
  })

  it('throws when GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = 'not-valid-json'

    await expect(listGoogleGroupMembers('eng@example.com')).rejects.toThrow(
      'GOOGLE_SERVICE_ACCOUNT_KEY must be a valid JSON string'
    )
  })

  it('returns members from a single page', async () => {
    mockMembersList.mockResolvedValue({
      data: {
        members: [
          { email: 'alice@example.com', id: '1', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
          { email: 'bob@example.com', id: '2', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
        ],
        nextPageToken: undefined,
      },
    })

    const result = await listGoogleGroupMembers('eng@example.com')

    expect(result).toHaveLength(2)
    expect(result[0].email).toBe('alice@example.com')
    expect(result[1].email).toBe('bob@example.com')
  })

  it('handles pagination by following nextPageToken', async () => {
    mockMembersList
      .mockResolvedValueOnce({
        data: {
          members: [{ email: 'alice@example.com', id: '1', role: 'MEMBER', type: 'USER', status: 'ACTIVE' }],
          nextPageToken: 'token-page-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          members: [{ email: 'bob@example.com', id: '2', role: 'MEMBER', type: 'USER', status: 'ACTIVE' }],
          nextPageToken: undefined,
        },
      })

    const result = await listGoogleGroupMembers('eng@example.com')

    expect(result).toHaveLength(2)
    expect(mockMembersList).toHaveBeenCalledTimes(2)
    expect(mockMembersList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pageToken: 'token-page-2' })
    )
  })

  it('returns empty array when members list is absent', async () => {
    mockMembersList.mockResolvedValue({ data: { nextPageToken: undefined } })

    const result = await listGoogleGroupMembers('eng@example.com')

    expect(result).toHaveLength(0)
  })

  it('filters out members with missing required fields', async () => {
    mockMembersList.mockResolvedValue({
      data: {
        members: [
          // Missing status
          { email: 'incomplete@example.com', id: '1', role: 'MEMBER', type: 'USER' },
          // Complete
          { email: 'complete@example.com', id: '2', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
        ],
        nextPageToken: undefined,
      },
    })

    const result = await listGoogleGroupMembers('eng@example.com')

    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('complete@example.com')
  })

  it('calls members.list with correct groupKey and maxResults', async () => {
    mockMembersList.mockResolvedValue({ data: { nextPageToken: undefined } })

    await listGoogleGroupMembers('eng@example.com')

    expect(mockMembersList).toHaveBeenCalledWith(
      expect.objectContaining({ groupKey: 'eng@example.com', maxResults: 200 })
    )
  })
})

describe('listGoogleGroups', () => {
  it('throws when credentials are missing', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

    await expect(listGoogleGroups()).rejects.toThrow('Missing Google Workspace credentials')
  })

  it('returns groups from a single page', async () => {
    mockGroupsList.mockResolvedValue({
      data: {
        groups: [
          {
            id: 'g1',
            email: 'eng@example.com',
            name: 'Engineering',
            description: 'Eng team',
            directMembersCount: '10',
          },
          {
            id: 'g2',
            email: 'design@example.com',
            name: 'Design',
            description: null,
            directMembersCount: '5',
          },
        ],
        nextPageToken: undefined,
      },
    })

    const result = await listGoogleGroups()

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'g1',
      email: 'eng@example.com',
      name: 'Engineering',
      description: 'Eng team',
      directMembersCount: 10,
    })
  })

  it('handles pagination by following nextPageToken', async () => {
    mockGroupsList
      .mockResolvedValueOnce({
        data: {
          groups: [{ id: 'g1', email: 'eng@example.com', name: 'Engineering', directMembersCount: '3' }],
          nextPageToken: 'page-2-token',
        },
      })
      .mockResolvedValueOnce({
        data: {
          groups: [{ id: 'g2', email: 'design@example.com', name: 'Design', directMembersCount: '2' }],
          nextPageToken: undefined,
        },
      })

    const result = await listGoogleGroups()

    expect(result).toHaveLength(2)
    expect(mockGroupsList).toHaveBeenCalledTimes(2)
    expect(mockGroupsList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pageToken: 'page-2-token' })
    )
  })

  it('parses domain from GOOGLE_ADMIN_EMAIL and uses it in the list call', async () => {
    mockGroupsList.mockResolvedValue({ data: { nextPageToken: undefined } })

    await listGoogleGroups()

    expect(mockGroupsList).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'example.com' })
    )
  })

  it('defaults directMembersCount to 0 when absent', async () => {
    mockGroupsList.mockResolvedValue({
      data: {
        groups: [{ id: 'g1', email: 'eng@example.com', name: 'Engineering' }],
        nextPageToken: undefined,
      },
    })

    const result = await listGoogleGroups()

    expect(result[0].directMembersCount).toBe(0)
  })

  it('returns empty array when groups list is absent', async () => {
    mockGroupsList.mockResolvedValue({ data: { nextPageToken: undefined } })

    const result = await listGoogleGroups()

    expect(result).toHaveLength(0)
  })

  it('filters out groups with missing required fields (no name)', async () => {
    mockGroupsList.mockResolvedValue({
      data: {
        groups: [
          // Missing name
          { id: 'g1', email: 'eng@example.com' },
          // Complete
          { id: 'g2', email: 'design@example.com', name: 'Design' },
        ],
        nextPageToken: undefined,
      },
    })

    const result = await listGoogleGroups()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('g2')
  })
})
