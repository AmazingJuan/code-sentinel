import { exec } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Server } from 'node:http';

import { saveSession, type StoredSession } from './credentials.js';

export interface LoginResult {
  token: string;
  user: {
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

export function renderLoginPage(port: number, apiUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Sentinel - CLI Authentication</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --border: #1f293d;
      --primary: #10b981;
      --primary-hover: #059669;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --error: #ef4444;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.25rem;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .badge {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--primary);
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
      font-weight: bold;
      font-size: 1.1rem;
    }
    .logo-text {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.025em;
    }
    .logo-text span { color: var(--primary); }
    .subtitle {
      color: var(--muted);
      font-size: 0.875rem;
      margin-top: 0.25rem;
      margin-bottom: 1.5rem;
      line-height: 1.4;
    }
    .target-api {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--border);
      color: #6ee7b7;
      word-break: break-all;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 0.5rem;
      font-family: var(--font-mono);
    }
    input {
      width: 100%;
      background: #060911;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.65rem 0.85rem;
      color: var(--text);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }
    .btn {
      width: 100%;
      background: var(--primary);
      color: #04100c;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      padding: 0.75rem;
      font-size: 0.95rem;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: none;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
    }
    .quick-fills {
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .quick-title {
      font-size: 0.75rem;
      color: var(--muted);
      font-family: var(--font-mono);
      text-transform: uppercase;
    }
    .pill-group {
      display: flex;
      gap: 0.5rem;
    }
    .pill {
      background: #1e293b;
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 0.75rem;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .pill:hover { background: #334155; }
    .success-view {
      display: none;
      text-align: center;
      padding: 1rem 0;
    }
    .checkmark {
      font-size: 3rem;
      color: var(--primary);
      margin-bottom: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="badge">&gt;_</div>
      <div>
        <div class="logo-text">code<span>sentinel</span></div>
        <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.1em;">CLI Auth : Port ${port}</div>
      </div>
    </div>

    <div id="login-container">
      <p class="subtitle">Enter your credentials to authorize the CLI with <span class="target-api">${apiUrl}</span></p>
    label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 0.5rem;
      font-family: var(--font-mono);
    }
    input {
      width: 100%;
      background: #060911;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.65rem 0.85rem;
      color: var(--text);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }
    .btn {
      width: 100%;
      background: var(--primary);
      color: #04100c;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      padding: 0.75rem;
      font-size: 0.95rem;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: none;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
    }
    .quick-fills {
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .quick-title {
      font-size: 0.75rem;
      color: var(--muted);
      font-family: var(--font-mono);
      text-transform: uppercase;
    }
    .pill-group {
      display: flex;
      gap: 0.5rem;
    }
    .pill {
      background: #1e293b;
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 0.75rem;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .pill:hover { background: #334155; }
    .success-view {
      display: none;
      text-align: center;
      padding: 1rem 0;
    }
    .checkmark {
      font-size: 3rem;
      color: var(--primary);
      margin-bottom: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="badge">&gt;_</div>
      <div>
        <div class="logo-text">code<span>sentinel</span></div>
        <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.1em;">CLI Authentication</div>
      </div>
    </div>

    <div id="login-container">
      <p class="subtitle">Enter your credentials to authorize the Code Sentinel Command Line Interface.</p>

      <div id="error-alert" class="alert alert-error"></div>

      <form id="login-form">
        <div class="form-group">
          <label for="email">Email address</label>
          <input id="email" type="email" required autocomplete="email" placeholder="you@company.com" />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
        </div>

        <button id="submit-btn" type="submit" class="btn">Authorize CLI</button>
      </form>

      <div class="quick-fills">
        <span class="quick-title">Quick demo fill</span>
        <div class="pill-group">
          <button type="button" class="pill" onclick="fill('demo@code-sentinel.local', 'Demo1234!')">Demo Analyst</button>
          <button type="button" class="pill" onclick="fill('admin@code-sentinel.local', 'Admin1234!')">Demo Admin</button>
        </div>
      </div>
    </div>

    <div id="success-view" class="success-view">
      <div class="checkmark">✓</div>
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Authentication Successful</h2>
      <p id="success-user-text" style="color: var(--muted); font-size: 0.9rem; margin-bottom: 1.25rem;"></p>
      <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--primary);">You may now close this browser tab and return to your terminal.</p>
    </div>
  </div>

  <script>
    function fill(email, pass) {
      document.getElementById('email').value = email;
      document.getElementById('password').value = pass;
    }

    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorAlert = document.getElementById('error-alert');
    const loginContainer = document.getElementById('login-container');
    const successView = document.getElementById('success-view');
    const successUserText = document.getElementById('success-user-text');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.innerText = 'Authenticating...';
      errorAlert.style.display = 'none';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          loginContainer.style.display = 'none';
          successUserText.innerText = 'Logged in as ' + (data.user?.name || email) + ' (' + email + ')';
          successView.style.display = 'block';
        } else {
          errorAlert.innerText = data.error || 'Authentication failed. Please verify credentials.';
          errorAlert.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.innerText = 'Authorize CLI';
        }
      } catch (err) {
        errorAlert.innerText = 'Unable to reach backend service: ' + err.message;
        errorAlert.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerText = 'Authorize CLI';
      }
    });
  </script>
</body>
</html>`;
}

export async function authenticateViaBackend(
  apiUrl: string,
  email: string,
  password: string,
): Promise<{ token: string; user: { email: string; name?: string; role?: string } }> {
  const loginRes = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const errData = await loginRes.json().catch(() => ({ message: 'Invalid credentials' }));
    const message = Array.isArray(errData?.message)
      ? errData.message.join(' ')
      : errData?.message || `HTTP ${loginRes.status}: Authentication failed`;
    throw new Error(message);
  }

  const { access_token } = (await loginRes.json()) as { access_token: string };

  // Fetch authenticated user profile details
  let user: { email: string; name?: string; role?: string } = { email };
  try {
    const meRes = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (meRes.ok) {
      const meData = (await meRes.json()) as { email: string; name?: string; role?: string };
      user = { email: meData.email, name: meData.name, role: meData.role };
    }
  } catch {
    // If /auth/me fails, keep baseline user email
  }

  return { token: access_token, user };
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
          res.end(renderLoginPage((server.address() as { port: number }).port, apiUrl));
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

              // Close server gracefully after sending response to browser
              setTimeout(() => {
                server.close();
                resolveSession({
                  token,
                  apiUrl,
                  user,
                  savedAt: new Date().toISOString(),
                });
              }, 1200);
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
