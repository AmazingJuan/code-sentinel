import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import { saveSession, type StoredSession } from './credentials.js';

export interface LoginResult {
  token: string;
  user: {
    id?: string;
    email: string;
    name?: string;
    role?: string;
  };
}

export function openBrowser(url: string): void {
  const platform = process.platform;
  let command = '';
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}" > /dev/null 2>&1`;
  }

  exec(command, () => {
    // Ignore browser open errors (e.g. headless Linux environments)
  });
}

function resolvePagePath(pageName: string): string {
  // 1. In dist/auth/pages (when running bundled from dist)
  const distPath = fileURLToPath(new URL(`./pages/${pageName}`, import.meta.url));
  if (existsSync(distPath)) return distPath;

  // 2. In src/auth/pages (when running from src or tests)
  const srcPath = fileURLToPath(new URL(`../pages/${pageName}`, import.meta.url));
  if (existsSync(srcPath)) return srcPath;

  return distPath;
}

export function renderLoginPage(): string {
  try {
    const pagePath = resolvePagePath('login.html');
    if (existsSync(pagePath)) {
      return readFileSync(pagePath, 'utf8');
    }
  } catch {
    // Fallback if file read fails
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Sentinel - CLI Authentication</title>
  <style>
    body { background: #090d16; color: #f3f4f6; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #111827; border: 1px solid #1f293d; border-radius: 12px; padding: 2.25rem; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #9ca3af; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; margin-bottom: 0.5rem; font-family: monospace; }
    input { width: 100%; box-sizing: border-box; background: #060911; border: 1px solid #1f293d; border-radius: 6px; padding: 0.7rem; color: #fff; margin-bottom: 1rem; }
    button { width: 100%; background: #10b981; color: #04100c; font-weight: 600; border: none; border-radius: 6px; padding: 0.75rem; cursor: pointer; }
    .alert { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem; display: none; }
    .demo-box { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid #1f293d; }
    .demo-btn { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid #1f293d; border-radius: 6px; padding: 0.55rem 0.75rem; color: #e5e7eb; margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-family: monospace; font-size: 0.8rem; cursor: pointer; }
    .demo-btn:hover { border-color: #10b981; color: #10b981; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Code Sentinel</h2>
    <p>Sign in to authorize Code Sentinel CLI.</p>
    <div id="error" class="alert"></div>
    <form id="form">
      <label>Email address</label>
      <input id="email" type="email" required />
      <label>Password</label>
      <input id="password" type="password" required />
      <button id="btn" type="submit">Sign in</button>
    </form>
    <div class="demo-box">
      <p style="font-family: monospace; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem; color: #9ca3af;">Demo Accounts (1-Click)</p>
      <button type="button" class="demo-btn" onclick="quick('demo@code-sentinel.local', 'Demo1234!')">
        <span>Demo Analyst</span>
        <span style="color: #9ca3af;">demo</span>
      </button>
      <button type="button" class="demo-btn" onclick="quick('admin@code-sentinel.local', 'Admin1234!')">
        <span>Administrator</span>
        <span style="color: #9ca3af;">admin</span>
      </button>
      <button type="button" class="demo-btn" onclick="quick('analyst@code-sentinel.local', 'Analyst1234!')">
        <span>Security Analyst</span>
        <span style="color: #9ca3af;">analyst</span>
      </button>
    </div>
  </div>
  <script>
    function quick(e, p) {
      document.getElementById('email').value = e;
      document.getElementById('password').value = p;
      document.getElementById('form').dispatchEvent(new Event('submit'));
    }
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      btn.disabled = true;
      btn.innerText = 'Authenticating...';
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          window.location.href = '/success';
        } else {
          document.getElementById('error').innerText = data.error || 'Invalid credentials.';
          document.getElementById('error').style.display = 'block';
          btn.disabled = false;
          btn.innerText = 'Sign in';
        }
      } catch (err) {
        document.getElementById('error').innerText = err.message;
        document.getElementById('error').style.display = 'block';
        btn.disabled = false;
        btn.innerText = 'Sign in';
      }
    };
  </script>
</body>
</html>`;
}

export function renderSuccessPage(): string {
  try {
    const pagePath = resolvePagePath('success.html');
    if (existsSync(pagePath)) {
      return readFileSync(pagePath, 'utf8');
    }
  } catch {
    // Fallback if file read fails
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Code Sentinel - Authentication Successful</title>
  <style>
    body { background: #090d16; color: #f3f4f6; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .card { background: #111827; border: 1px solid #1f293d; border-radius: 12px; padding: 2.5rem; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .check { font-size: 3rem; color: #10b981; margin-bottom: 1rem; }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #9ca3af; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem; }
    .hint { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; color: #10b981; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h2>Authentication successful</h2>
    <p>The session for Code Sentinel CLI has been successfully authorized.</p>
    <div class="hint">You can now close this window and return to your terminal.</div>
  </div>
</body>
</html>`;
}

export async function authenticateViaBackend(
  apiUrl: string,
  email: string,
  password: string,
): Promise<{ token: string; user: { id?: string; email: string; name?: string; role?: string } }> {
  const loginRes = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const errData = await loginRes.json().catch(() => ({ message: 'Invalid credentials' }));
    const message = Array.isArray(errData?.message)
      ? errData.message.join(' ')
      : errData?.message || `HTTP ${loginRes.status}: Failed to sign in`;
    throw new Error(message);
  }

  const data = (await loginRes.json()) as {
    accessToken?: string;
    access_token?: string;
    token?: string;
    user?: { id?: string; email: string; name?: string; role?: string };
  };

  const token = data.accessToken || data.access_token || data.token;
  if (!token) {
    throw new Error('Server response did not include a valid access token');
  }

  const user = data.user || { email };
  return { token, user };
}

export function startLoginServer(
  apiUrl: string,
  preferredPort: number = 0,
): Promise<{ server: Server; port: number; sessionPromise: Promise<StoredSession> }> {
  return new Promise((resolveServer, rejectServer) => {
    let server: Server;

    const sessionPromise = new Promise<StoredSession>((resolveSession, rejectSession) => {
      server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // Set CORS headers for local requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://${req.headers.host}`);

        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/login')) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderLoginPage());
          return;
        }

        if (req.method === 'GET' && url.pathname === '/success') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderSuccessPage());
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/login') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const { email, password } = JSON.parse(body);
              if (!email || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Email and password are required' }));
                return;
              }

              const { token, user } = await authenticateViaBackend(apiUrl, email, password);

              saveSession({ token, apiUrl, user });

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, user }));

              // Allow browser to complete redirection to /success before closing server
              setTimeout(() => {
                server.close();
                resolveSession({
                  token,
                  apiUrl,
                  user,
                  savedAt: new Date().toISOString(),
                });
              }, 2500);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: message }));
            }
          });
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      });

      server.on('error', (err) => {
        rejectServer(err);
        rejectSession(err);
      });

      server.listen(preferredPort, '127.0.0.1', () => {
        const address = server.address() as { port: number };
        resolveServer({ server, port: address.port, sessionPromise });
      });
    });
  });
}
