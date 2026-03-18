import { google } from 'googleapis'

function getCredentials() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL

  if (!serviceAccountEmail || !serviceAccountKey || !adminEmail) {
    throw new Error(
      'Missing Google Workspace credentials. Required: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_ADMIN_EMAIL'
    )
  }

  let keyData: { private_key: string; client_email: string }
  try {
    keyData = JSON.parse(serviceAccountKey)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY must be a valid JSON string')
  }

  return { serviceAccountEmail, keyData, adminEmail }
}

export function getGoogleAdminClient() {
  const { keyData, adminEmail } = getCredentials()

  const auth = new google.auth.JWT({
    email: keyData.client_email,
    key: keyData.private_key,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.group.readonly',
      'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
    ],
    subject: adminEmail,
  })

  return google.admin({ version: 'directory_v1', auth })
}

export interface GoogleGroupMember {
  email: string
  id: string
  role: string
  type: string
  status: string
}

export async function listGoogleGroupMembers(groupEmail: string): Promise<GoogleGroupMember[]> {
  const admin = getGoogleAdminClient()
  const members: GoogleGroupMember[] = []
  let pageToken: string | undefined

  do {
    const response = await admin.members.list({
      groupKey: groupEmail,
      maxResults: 200,
      pageToken,
    })

    const data = response.data
    if (data.members) {
      for (const m of data.members) {
        if (m.email && m.id && m.role && m.type && m.status) {
          members.push({
            email: m.email,
            id: m.id,
            role: m.role,
            type: m.type,
            status: m.status,
          })
        }
      }
    }

    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)

  return members
}

export interface GoogleGroup {
  id: string
  email: string
  name: string
  description: string | null
  directMembersCount: number
}

export async function listGoogleGroups(): Promise<GoogleGroup[]> {
  const admin = getGoogleAdminClient()
  const groups: GoogleGroup[] = []
  let pageToken: string | undefined

  const { adminEmail } = getCredentials()
  const domain = adminEmail.split('@')[1]

  do {
    const response = await admin.groups.list({
      domain,
      maxResults: 200,
      pageToken,
    })

    const data = response.data
    if (data.groups) {
      for (const g of data.groups) {
        if (g.id && g.email && g.name) {
          groups.push({
            id: g.id,
            email: g.email,
            name: g.name,
            description: g.description ?? null,
            directMembersCount: parseInt(g.directMembersCount ?? '0', 10),
          })
        }
      }
    }

    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)

  return groups
}

export interface GoogleUser {
  id: string
  email: string
  displayName: string | null
  givenName: string | null
  familyName: string | null
  suspended: boolean
}

export async function getGoogleUser(userId: string): Promise<GoogleUser> {
  const admin = getGoogleAdminClient()

  const response = await admin.users.get({ userKey: userId })
  const u = response.data

  return {
    id: u.id ?? userId,
    email: u.primaryEmail ?? userId,
    displayName: u.name?.fullName ?? null,
    givenName: u.name?.givenName ?? null,
    familyName: u.name?.familyName ?? null,
    suspended: u.suspended ?? false,
  }
}
