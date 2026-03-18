# System Architecture

## High-Level Architecture

```mermaid
flowchart TB
    subgraph clients["Clients"]
        browser["Browser<br/>Admin / Viewer"]
        vpnClient["OpenVPN Client"]
    end

    subgraph app["Next.js Application :3000"]
        direction TB
        nextAuth["NextAuth.js<br/>JWT Sessions"]
        middleware["Middleware<br/>Auth + RBAC"]
        api["API Routes<br/>REST"]
        ui["React UI<br/>Dashboard"]

        ui --> middleware
        api --> middleware
        middleware --> nextAuth
    end

    subgraph services["Core Services"]
        direction TB
        certSvc["Certificate Service<br/>EasyRSA wrapper"]
        ccdGen["CCD Generator<br/>Client config builder"]
        syncEngine["Sync Engine<br/>Google Workspace"]
        importSvc["Import Service<br/>User discovery"]
        driftSvc["Drift Detection<br/>Config reconciliation"]
        auditSvc["Audit Logger"]
        rateLimiter["Rate Limiter<br/>Login protection"]
        opQueue["Operation Queue<br/>Per-server serialization"]
    end

    subgraph transport["Transport Layer"]
        direction LR
        sshT["SSH Transport<br/>ssh2"]
        ssmT["SSM Transport<br/>AWS SDK"]
        agentT["Agent Transport<br/>Custom API"]
    end

    subgraph infra["Infrastructure"]
        direction TB
        db[("PostgreSQL 16<br/>Prisma ORM")]
        vpnServer["OpenVPN Server<br/>EasyRSA + CCD"]
        googleWS["Google Workspace<br/>Admin API"]
        aws["AWS<br/>Secrets Manager / SSM"]
    end

    browser --> ui
    browser --> api
    vpnClient --> vpnServer

    api --> services
    services --> transport
    services --> db
    services --> auditSvc --> db

    transport --> vpnServer
    ssmT --> aws
    syncEngine --> googleWS

    certSvc --> transport
    ccdGen --> transport
    importSvc --> transport
    driftSvc --> transport
```

## Component Responsibilities

| Component | Purpose |
|-----------|---------|
| **Next.js App** | Web UI and REST API, server-side rendered |
| **NextAuth.js** | JWT-based authentication (Google OAuth + credentials) |
| **Middleware** | Route protection, session validation, RBAC enforcement |
| **Certificate Service** | Generate, revoke, and check client certificates via EasyRSA |
| **CCD Generator** | Build per-client config files from group CIDR memberships |
| **Sync Engine** | Bidirectional sync between Google Workspace groups and VPN groups |
| **Import Service** | Discover and import existing users from OpenVPN server filesystem |
| **Drift Detection** | Compare database state vs. server state, flag mismatches |
| **Operation Queue** | Serialize cert/CCD operations per server to prevent conflicts |
| **Transport Layer** | Abstract server communication (SSH, AWS SSM, or custom agent) |
| **PostgreSQL** | Persistent storage for users, servers, groups, audit logs, settings |
| **OpenVPN Server** | VPN endpoint with EasyRSA PKI and CCD directory |
| **Google Workspace** | External identity and group membership source |
