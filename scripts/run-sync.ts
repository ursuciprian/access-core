#!/usr/bin/env tsx
/**
 * CLI script to trigger a Google Workspace sync for a given server.
 *
 * Usage:
 *   npx tsx scripts/run-sync.ts --serverId <id> [--triggeredBy <email>]
 *
 * Environment variables required:
 *   DATABASE_URL
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_KEY  (JSON string of the service account key file)
 *   GOOGLE_ADMIN_EMAIL
 */

import { runGoogleSync } from '../src/lib/sync-engine'

function parseArgs(): { serverId: string; triggeredBy: string } {
  const args = process.argv.slice(2)
  let serverId = ''
  let triggeredBy = 'cli-script'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--serverId' && args[i + 1]) {
      serverId = args[i + 1]
      i++
    } else if (args[i] === '--triggeredBy' && args[i + 1]) {
      triggeredBy = args[i + 1]
      i++
    }
  }

  if (!serverId) {
    console.error('Error: --serverId is required')
    console.error('Usage: npx tsx scripts/run-sync.ts --serverId <id> [--triggeredBy <email>]')
    process.exit(1)
  }

  return { serverId, triggeredBy }
}

async function main() {
  const { serverId, triggeredBy } = parseArgs()

  console.log(`Starting Google Workspace sync for server: ${serverId}`)
  console.log(`Triggered by: ${triggeredBy}`)
  console.log('---')

  try {
    const result = await runGoogleSync(serverId, triggeredBy)

    console.log('Sync completed successfully')
    console.log(`  Sync job ID:         ${result.syncJobId}`)
    console.log(`  Mappings processed:  ${result.mappingsProcessed}`)
    console.log(`  Users added:         ${result.usersAdded}`)
    console.log(`  Users flagged:       ${result.usersFlagged}`)

    if (result.errors.length > 0) {
      console.log(`  Errors (${result.errors.length}):`)
      for (const err of result.errors) {
        console.warn(`    - ${err}`)
      }
    }

    process.exit(0)
  } catch (err) {
    console.error('Sync failed with error:')
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()
