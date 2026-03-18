import { PrismaClient, TransportType, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { hashSync } from 'bcryptjs'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/openvpn_gui?schema=public'
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

function getSeedAdminConfig() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email && !password) {
    return null
  }

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided together')
  }

  if (!email.includes('@')) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid email address')
  }

  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters long')
  }

  return { email, password }
}

async function main() {
  // Seed default VPN server
  const server = await prisma.vpnServer.upsert({
    where: { id: 'default-server' },
    update: {},
    create: {
      id: 'default-server',
      name: 'Local Dev VPN Server',
      hostname: 'localhost',
      transport: TransportType.SSH,
      sshHost: 'localhost',
      sshPort: 2222,
      sshUser: 'root',
      sshKeySecretId: 'LOCAL_DEV',
      ccdPath: '/etc/openvpn/ccd',
      easyRsaPath: '/etc/openvpn/easy-rsa',
      serverConf: '/etc/openvpn/server.conf',
      isActive: true,
    },
  })

  console.log(`Seeded VPN server: ${server.name} (${server.id})`)

  const seedAdmin = getSeedAdminConfig()
  if (seedAdmin) {
    const adminPassword = hashSync(seedAdmin.password, 10)
    const admin = await prisma.adminUser.upsert({
      where: { email: seedAdmin.email },
      update: { password: adminPassword, isApproved: true },
      create: {
        email: seedAdmin.email,
        password: adminPassword,
        role: UserRole.ADMIN,
        isApproved: true,
      },
    })

    console.log(`Seeded admin user: ${admin.email} (${admin.role})`)
  } else {
    console.log('Skipped admin user seed. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create an initial admin account.')
  }

  // Seed example groups
  const engineeringGroup = await prisma.vpnGroup.upsert({
    where: { name_serverId: { name: 'Engineering', serverId: server.id } },
    update: {},
    create: {
      name: 'Engineering',
      description: 'Engineering team - access to dev and staging environments',
      serverId: server.id,
      cidrBlocks: {
        create: [
          { cidr: '10.0.1.0/24', description: 'Development VPC' },
          { cidr: '10.0.2.0/24', description: 'Staging VPC' },
        ],
      },
    },
  })

  console.log(`Seeded group: ${engineeringGroup.name}`)

  const opsGroup = await prisma.vpnGroup.upsert({
    where: { name_serverId: { name: 'Operations', serverId: server.id } },
    update: {},
    create: {
      name: 'Operations',
      description: 'Operations team - access to production monitoring',
      serverId: server.id,
      cidrBlocks: {
        create: [
          { cidr: '10.0.3.0/24', description: 'Production VPC' },
          { cidr: '10.0.4.0/24', description: 'Monitoring VPC' },
        ],
      },
    },
  })

  console.log(`Seeded group: ${opsGroup.name}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
