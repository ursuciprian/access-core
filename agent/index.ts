/**
 * AccessCore Agent Service
 *
 * Lightweight HTTP server deployed on the VPN server.
 * Accepts authenticated POST /execute requests and runs shell commands.
 *
 * Security model:
 *   - Listens on localhost (127.0.0.1) by default — not exposed to internet.
 *   - Every request (except GET /health) must carry a valid Bearer token
 *     matching AGENT_API_KEY.
 *   - exec() is used intentionally: this service IS a remote command executor.
 *     Callers must be treated as trusted (the AccessCore backend, not end users).
 */

import http from "http";
import { exec } from "child_process";

const API_KEY = process.env.AGENT_API_KEY ?? "";
const HOST = process.env.AGENT_HOST ?? "127.0.0.1";
const PORT = parseInt(process.env.AGENT_PORT ?? "8443", 10);
const TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? "60000", 10);
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(method: string, path: string, status: number): void {
  process.stdout.write(`${new Date().toISOString()} ${method} ${path} ${status}\n`);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_OUTPUT_BYTES) {
        reject(new Error("Request body exceeds 1 MB limit"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authenticate(req: http.IncomingMessage): boolean {
  if (!API_KEY) return false;
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return token === API_KEY;
}

function truncate(s: string): string {
  if (Buffer.byteLength(s) <= MAX_OUTPUT_BYTES) return s;
  // Slice by bytes, not chars, to stay within limit
  return Buffer.from(s).slice(0, MAX_OUTPUT_BYTES).toString("utf8") + "\n[output truncated]";
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCommand(command: string): Promise<ExecuteResult> {
  return new Promise((resolve) => {
    exec(
      command,
      { timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES },
      (error, stdout, stderr) => {
        let exitCode = 0;
        if (error) {
          // error.code is the numeric exit code; signals produce null code
          exitCode = typeof error.code === "number" ? error.code : 1;
        }
        resolve({ exitCode, stdout: truncate(stdout), stderr: truncate(stderr) });
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = req.url ?? "/";

  // Health probe — no auth required so load balancers / Docker can poll it
  if (method === "GET" && url === "/health") {
    log(method, url, 200);
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (!authenticate(req)) {
    log(method, url, 401);
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  if (method === "POST" && url === "/execute") {
    let bodyText: string;
    try {
      bodyText = await readBody(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read body";
      log(method, url, 400);
      sendJson(res, 400, { error: message });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      log(method, url, 400);
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    if (typeof parsed.command !== "string" || !parsed.command.trim()) {
      log(method, url, 400);
      sendJson(res, 400, { error: "Field 'command' must be a non-empty string" });
      return;
    }

    const result = await runCommand(parsed.command);
    log(method, url, 200);
    sendJson(res, 200, result);
    return;
  }

  log(method, url, 404);
  sendJson(res, 404, { error: "Not found" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.on("error", (err: NodeJS.ErrnoException) => {
  process.stderr.write(`fatal: ${err.message}\n`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const ts = new Date().toISOString();
  process.stdout.write(`${ts} agent listening on http://${HOST}:${PORT}\n`);
  if (!API_KEY) {
    process.stderr.write(
      `${ts} ERROR: AGENT_API_KEY is not set — all authenticated requests will be rejected\n`
    );
  }
});
