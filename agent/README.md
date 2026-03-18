# AccessCore Agent Service

A minimal HTTP service that runs on the VPN server and accepts authenticated command execution requests from the AccessCore backend.

## How it works

- Listens on `127.0.0.1:8443` by default (localhost only, not reachable from the internet)
- `POST /execute` — runs a shell command and returns stdout/stderr/exitCode
- `GET /health` — returns `{"status":"ok"}` (no auth required)
- All non-health requests require `Authorization: Bearer <AGENT_API_KEY>`

## Environment variables

| Variable           | Default       | Description                                    |
|--------------------|---------------|------------------------------------------------|
| `AGENT_API_KEY`    | *(required)*  | Shared secret; must match the GUI's config     |
| `AGENT_HOST`       | `127.0.0.1`   | Interface to listen on                         |
| `AGENT_PORT`       | `8443`        | Port to listen on                              |
| `AGENT_TIMEOUT_MS` | `60000`       | Max milliseconds a command may run             |

## Deploy with Docker

```bash
docker build -t accesscore-agent .

docker run -d \
  --name accesscore-agent \
  --restart unless-stopped \
  --network host \
  -e AGENT_API_KEY="$(openssl rand -hex 32)" \
  accesscore-agent
```

`--network host` keeps the container bound to the host's loopback interface so it remains localhost-only.

## Deploy with systemd

1. Build the binary:

```bash
cd agent
npm install
npm run build
```

2. Create `/etc/systemd/system/accesscore-agent.service`:

```ini
[Unit]
Description=AccessCore Agent
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=/opt/accesscore-agent
ExecStart=/usr/bin/node /opt/accesscore-agent/dist/index.js
Restart=on-failure
RestartSec=5

Environment=AGENT_API_KEY=<your-secret-here>
Environment=AGENT_HOST=127.0.0.1
Environment=AGENT_PORT=8443

# Harden the service
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

3. Enable and start:

```bash
systemctl daemon-reload
systemctl enable --now openvpn-gui-agent
```

## Security notes

- **Localhost only by default.** Do not set `AGENT_HOST=0.0.0.0` unless the port is firewalled. This service executes arbitrary shell commands.
- **Rotate the API key** if the GUI server is ever compromised. The key is a shared secret — use `openssl rand -hex 32` to generate one.
- **Principle of least privilege.** Run as a non-root user when possible; only grant `sudo` for the specific OpenVPN commands the GUI needs.
- **No TLS termination built-in.** If the GUI and agent communicate over a non-loopback network (e.g. different hosts on a VPC), put an mTLS proxy (nginx, caddy) or a WireGuard tunnel in front.

## API reference

### POST /execute

Request:

```json
{ "command": "openvpn --status /run/openvpn/server.status" }
```

Response:

```json
{
  "exitCode": 0,
  "stdout": "...",
  "stderr": ""
}
```

### GET /health

Response (no auth required):

```json
{ "status": "ok" }
```
