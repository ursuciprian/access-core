import { SyncStatus, SyncType, MembershipSource } from '@prisma/client'
import { prisma } from './prisma'
import { listGoogleGroupMembers } from './google-workspace'

export interface SyncResult {
  syncJobId: string
  serverId: string
  usersAdded: number
  usersFlagged: number
  mappingsProcessed: number
  errors: string[]
}

function deriveCommonNameFromEmail(email: string): string {
  return email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}

export async function runGoogleSync(serverId: string, triggeredBy: string): Promise<SyncResult> {

  // Step 1: Create SyncJob with status IN_PROGRESS
  const syncJob = await prisma.syncJob.create({
    data: {
      type: SyncType.GOOGLE_SYNC,
      status: SyncStatus.IN_PROGRESS,
      serverId,
      triggeredBy,
      startedAt: new Date(),
    },
  })

  const errors: string[] = []
  let usersAdded = 0
  let usersFlagged = 0

  try {
    // Step 2: Fetch all GoogleGroupMappings for this server
    const mappings = await prisma.googleGroupMapping.findMany({
      where: {
        vpnGroup: { serverId },
      },
      include: {
        vpnGroup: true,
      },
    })

    // Step 3: For each mapping, fetch ALL Google group members (paginated)
    // Build a map: vpnGroupId -> Set of google member emails
    const groupMemberEmails = new Map<string, Set<string>>()

    for (const mapping of mappings) {
      try {
        const members = await listGoogleGroupMembers(mapping.googleGroupEmail)
        // Only include USER type members (not groups within groups)
        const emailSet = new Set(
          members
            .filter((m) => m.type === 'USER' && m.status === 'ACTIVE')
            .map((m) => m.email.toLowerCase())
        )
        groupMemberEmails.set(mapping.id, emailSet)
      } catch (err) {
        const msg = `Failed to fetch members for ${mapping.googleGroupEmail}: ${err instanceof Error ? err.message : String(err)}`
        errors.push(msg)
        groupMemberEmails.set(mapping.id, new Set())
      }
    }

    // Step 4: Compare with current DB state per mapping
    for (const mapping of mappings) {
      const googleEmails = groupMemberEmails.get(mapping.id) ?? new Set<string>()
      const vpnGroupId = mapping.vpnGroupId

      // Get current DB members of this VPN group that came from GOOGLE_SYNC
      const currentMemberships = await prisma.vpnUserGroup.findMany({
        where: {
          groupId: vpnGroupId,
          source: MembershipSource.GOOGLE_SYNC,
        },
        include: {
          user: true,
        },
      })

      const currentEmailsInGroup = new Map(
        currentMemberships.map((m) => [m.user.email.toLowerCase(), m])
      )

      // New members: in Google but not in DB for this group
      for (const email of googleEmails) {
        if (!currentEmailsInGroup.has(email)) {
          try {
            // Upsert VpnUser
            let user = await prisma.vpnUser.findUnique({
              where: { email_serverId: { email, serverId } },
            })

            if (!user) {
              const commonName = deriveCommonNameFromEmail(email)
              // Handle CN collision by appending a suffix
              let finalCN = commonName
              let cnExists = await prisma.vpnUser.findUnique({
                where: { commonName_serverId: { commonName: finalCN, serverId } },
              })
              let suffix = 1
              while (cnExists) {
                finalCN = `${commonName}_${suffix}`
                suffix++
                cnExists = await prisma.vpnUser.findUnique({
                  where: { commonName_serverId: { commonName: finalCN, serverId } },
                })
              }

              user = await prisma.vpnUser.create({
                data: {
                  email,
                  commonName: finalCN,
                  serverId,
                },
              })
              usersAdded++
            }

            // Add to VPN group if not already a member
            await prisma.vpnUserGroup.upsert({
              where: { userId_groupId: { userId: user.id, groupId: vpnGroupId } },
              update: { source: MembershipSource.GOOGLE_SYNC },
              create: {
                userId: user.id,
                groupId: vpnGroupId,
                source: MembershipSource.GOOGLE_SYNC,
              },
            })
          } catch (err) {
            const msg = `Failed to add user ${email} to group ${mapping.vpnGroup.name}: ${err instanceof Error ? err.message : String(err)}`
            errors.push(msg)
          }
        }
      }

      // Removed members: in DB but not in Google for this mapping
      for (const [email, membership] of currentEmailsInGroup) {
        if (!googleEmails.has(email)) {
          // Check if user is still in another Google mapping that maps to the same VPN group
          const otherMappingsForSameGroup = mappings.filter(
            (m) => m.id !== mapping.id && m.vpnGroupId === vpnGroupId
          )

          let stillInAnotherMapping = false
          for (const otherMapping of otherMappingsForSameGroup) {
            const otherEmails = groupMemberEmails.get(otherMapping.id) ?? new Set<string>()
            if (otherEmails.has(email)) {
              stillInAnotherMapping = true
              break
            }
          }

          if (!stillInAnotherMapping) {
            try {
              await prisma.vpnUser.update({
                where: { id: membership.user.id },
                data: {
                  isFlagged: true,
                  flagReason: `Removed from Google group: ${mapping.googleGroupEmail}`,
                  flaggedAt: new Date(),
                },
              })
              usersFlagged++
            } catch (err) {
              const msg = `Failed to flag user ${email}: ${err instanceof Error ? err.message : String(err)}`
              errors.push(msg)
            }
          }
        }
      }
    }

    // Step 5: Update SyncJob with results
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncStatus.SUCCESS,
        completedAt: new Date(),
        details: {
          usersAdded,
          usersFlagged,
          mappingsProcessed: mappings.length,
          errors,
        },
      },
    })

    return {
      syncJobId: syncJob.id,
      serverId,
      usersAdded,
      usersFlagged,
      mappingsProcessed: mappings.length,
      errors,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncStatus.FAILED,
        completedAt: new Date(),
        error: errorMessage,
        details: { usersAdded, usersFlagged, errors: [...errors, errorMessage] },
      },
    })

    throw err
  }
}
