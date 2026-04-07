# Getting Started

This guide covers local development setup and cloud deployment for AccessCore.

---

## Prerequisites

- **Node.js** 20+
- **Docker** and **Docker Compose**
- **Git**
- A **Google Cloud** or OIDC identity provider setup (optional, for SSO)

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url> accesscore
cd accesscore
npm install
```

### 2. Environment configuration

Copy the example environment file and customize it:

```bash
cp .env.example .env
# or create .env manually with the values below
```

Required variables for local development:

```env
# Database
DATABASE_URL="postgresql://localhost:5433/openvpn_gui"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"

# Google OAuth (optional for local dev)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_ALLOWED_DOMAIN=""

# OIDC SSO (optional for local dev)
OIDC_SSO_ENABLED="false"
OIDC_PROVIDER_NAME="Okta"
OIDC_ISSUER=""
OIDC_CLIENT_ID=""
OIDC_CLIENT_SECRET=""
OIDC_SCOPES="openid email profile"
OIDC_ALLOWED_DOMAINS=""

# Local OpenVPN server (Docker)
SSH_PASS_LOCAL_DEV="openvpn"
ALLOW_SSH_PASSWORD_AUTH="true"

# Optional local seed admin
SEED_ADMIN_EMAIL="admin@local.test"
SEED_ADMIN_PASSWORD="change-this-demo-password"
```

Generate a strong secret:

```bash
openssl rand -base64 32
```

### 3. Start infrastructure

Launch PostgreSQL and the OpenVPN test server:

```bash
npm run docker:up
```

This starts:
- **PostgreSQL 16** on port `5433`
- **OpenVPN server** on port `1194/UDP` (VPN) and `2222/TCP` (SSH management)
- **Internal test app** on the isolated Docker bridge network (accessible only via VPN)

If Docker reports `invalid pool request: Pool overlaps with other one on this address space`, override the internal bridge subnet before starting Compose:

```bash
export VPN_INTERNAL_SUBNET=172.31.251.0/24
export VPN_INTERNAL_GATEWAY_IP=172.31.251.2
export VPN_INTERNAL_APP_IP=172.31.251.100
docker compose -f docker/compose.yml up -d --build
```

You can also override the routed OpenVPN client subnet if needed:

```bash
export OPENVPN_CLIENT_SUBNET=10.8.0.0/24
```

### 4. Initialize the database

```bash
npm run db:migrate
npm run db:seed
```

The seed command always creates the local development VPN server and demo groups. It only creates an admin account when both of these environment variables are set:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Recommended local setup:

```bash
export SEED_ADMIN_EMAIL="admin@local.test"
export SEED_ADMIN_PASSWORD="change-this-demo-password"
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the admin account you seeded.

### 6. (Optional) Configure Google SSO

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Set the authorized redirect URI to: `http://localhost:3000/api/auth/callback/google`
3. Add your credentials to `.env`:

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<google-oauth-client-secret>"
GOOGLE_ALLOWED_DOMAIN="yourcompany.com"
```

4. Restart the dev server. AccessCore will automatically show the Google sign-in option when the provider is configured.

### 7. (Optional) Configure OIDC SSO

1. Create an OIDC application in your identity provider
2. Set the redirect URI to: `http://localhost:3000/api/auth/callback/oidc`
3. Add your credentials to `.env`:

```env
OIDC_SSO_ENABLED="true"
OIDC_PROVIDER_NAME="Okta"
OIDC_ISSUER="https://your-org.okta.com/oauth2/default"
OIDC_CLIENT_ID="your-client-id"
OIDC_CLIENT_SECRET="your-client-secret"
OIDC_SCOPES="openid email profile"
OIDC_ALLOWED_DOMAINS="yourcompany.com"
```

4. Restart the dev server
5. The login page will show `Continue with Okta` and the sign-in flow will still pass through AccessCore approval and MFA onboarding

### 8. (Optional) Google Workspace sync

To enable group-based sync from Google Workspace:

1. Create a service account in Google Cloud Console
2. Enable domain-wide delegation
3. Enable the Admin SDK API
4. Add to `.env`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL="sa@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
GOOGLE_ADMIN_EMAIL="admin@yourcompany.com"
```

5. In the portal: **Admin > Settings > Enable Google Sync**
6. Create group mappings at **/sync** to link Google groups to VPN groups

### Local development tips

- **Prisma Studio** for browsing the database: `npx prisma studio`
- **Reset database**: `npx prisma migrate reset` (drops and recreates)
- **Run tests**: `npm test`
- **Lint**: `npm run lint`
- **Docker logs**: `npm run docker:logs -- openvpn`

### Local installation checklist

1. Copy `.env.example` to `.env`
2. Set `NEXTAUTH_SECRET`
3. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
4. Start Docker services with `npm run docker:up`
5. Run `npm run db:migrate`
6. Run `npm run db:seed`
7. Start the app with `npm run dev`

---

## Cloud Deployment

### Option A: Docker (Single Server)

For small teams or testing. Suitable for a single VM (EC2, Droplet, etc.).

#### 1. Build the Docker image

```bash
docker build -f docker/app/Dockerfile.prod -t accesscore .
```

#### 2. Set up PostgreSQL

Use a managed database (RDS, Cloud SQL) or run PostgreSQL in Docker:

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_DB=openvpn_gui \
  -e POSTGRES_USER=openvpn \
  -e POSTGRES_PASSWORD=<strong-password> \
  -p 5432:5432 \
  postgres:16-alpine
```

#### 3. Run the application

```bash
docker run -d \
  --name accesscore \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://<db-host>:5432/openvpn_gui" \
  -e NEXTAUTH_URL="https://vpn.yourcompany.com" \
  -e NEXTAUTH_SECRET="<openssl rand -base64 32>" \
  -e GOOGLE_CLIENT_ID="<your-client-id>" \
  -e GOOGLE_CLIENT_SECRET="<your-secret>" \
  -e GOOGLE_ALLOWED_DOMAIN="yourcompany.com" \
  accesscore
```

#### 4. Run database migrations

```bash
docker exec accesscore npx prisma migrate deploy
```

#### 5. Put behind a reverse proxy

Use nginx or Caddy for TLS termination:

```nginx
server {
    listen 443 ssl;
    server_name vpn.yourcompany.com;

    ssl_certificate     /etc/letsencrypt/live/vpn.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vpn.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option B: AWS Production (Recommended)

For production deployments with high availability and security. See [AWS Secure Deployment](./aws-secure-deployment.md) for the full guide.

#### Architecture summary

```
Internet → Route 53 → ALB (HTTPS + Google OIDC) → ECS Fargate (private) → RDS PostgreSQL (private)
                                                                        → OpenVPN EC2 (SSH private, 1194/UDP public)
```

#### Quick steps

1. **VPC**: Create VPC with public and private subnets across 2+ AZs
2. **RDS**: Deploy PostgreSQL 16 in private subnets
3. **Secrets Manager**: Store `DATABASE_URL`, `NEXTAUTH_SECRET`, SSH keys, Google credentials
4. **ECR**: Push the Docker image to Amazon ECR
5. **ECS Fargate**: Deploy the app in private subnets with secrets injected from Secrets Manager
6. **ALB**: Create a public ALB with:
   - HTTPS listener (ACM certificate)
   - Google OIDC authenticate action
   - Forward to ECS target group
7. **Route 53**: Point `vpn.yourcompany.com` to the ALB
8. **OpenVPN EC2**: Deploy in public subnet with only `1194/UDP` exposed
9. **Security groups**: Follow the rules in [Network Security Architecture](./diagrams/network-security.md)

#### Key environment variables for production

```env
NODE_ENV="production"
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://vpn.yourcompany.com"
NEXTAUTH_SECRET="<strong-32-byte-random>"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_ALLOWED_DOMAIN="yourcompany.com"
TRUST_PROXY_HEADERS="true"
```

### Option C: Other Cloud Providers

The app is a standard Next.js + PostgreSQL stack. It runs on any platform that supports Node.js 20+:

| Provider | Compute | Database | Notes |
|----------|---------|----------|-------|
| **GCP** | Cloud Run / GKE | Cloud SQL PostgreSQL | Use IAP for edge auth |
| **Azure** | App Service / AKS | Azure Database for PostgreSQL | Use Azure AD for SSO |
| **DigitalOcean** | App Platform | Managed PostgreSQL | Simple, cost-effective |
| **Railway** | Railway app | Railway PostgreSQL | Fastest setup, auto-deploy |
| **Vercel** | Vercel (serverless) | Neon / Supabase | Note: SSH transport requires persistent connections |

---

## Post-Deployment Checklist

- [ ] `NEXTAUTH_SECRET` is a cryptographically random 32+ byte value
- [ ] `GOOGLE_ALLOWED_DOMAIN` is set to restrict sign-ins
- [ ] Database is not publicly accessible
- [ ] HTTPS is enforced (TLS termination at proxy/ALB)
- [ ] Default seed credentials are changed or seed was never run in production
- [ ] SSH keys (not passwords) are used for VPN server transport
- [ ] Audit logging is enabled and monitored
- [ ] Backups are configured for the database
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] HSTS header is active

---

## Connecting a VPN Server

Once the portal is running:

1. Go to **Servers > Add Server**
2. Configure the transport:
   - **SSH**: hostname, port, username, SSH key secret ID
   - **SSM**: AWS instance ID, region
   - **Agent**: agent URL, API key secret ID
3. Set the **EasyRSA path** (e.g., `/etc/openvpn/easy-rsa`)
4. Set the **CCD path** (e.g., `/etc/openvpn/ccd`)
5. Test the connection from the server detail page
6. Import existing users with **Server > Import**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't connect to database | Check `DATABASE_URL` and that PostgreSQL is running |
| Google SSO not working | Verify redirect URI matches `NEXTAUTH_URL/api/auth/callback/google` |
| SSH transport fails | Check SSH key env var `SSH_KEY_<secretId>` is set, host is reachable |
| Migrations fail | Run `npx prisma migrate deploy` (production) or `npx prisma migrate dev` (local) |
| Rate limited during dev | Reset with `npx prisma db seed` or clear `AuthRateLimit` table |
| CCD push fails | Verify CCD path exists on server and transport user has write permission |
