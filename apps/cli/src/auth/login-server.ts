import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

import { fetchWithTimeout } from '../backend/http.js';
import { errorMessage } from '../domain/errors.js';
import { saveSession, type SessionUser, type StoredSession } from './credentials.js';

/** How long the local login page waits for the user before giving up. */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_LOGIN_BODY_BYTES = 16 * 1024;
const SERVER_CLOSE_DELAY_MS = 2500;

export interface LoginResult {
  token: string;
  user: SessionUser;
}

export interface LoginServer {
  server: Server;
  port: number;
  sessionPromise: Promise<StoredSession>;
}

export function openBrowser(url: string): void {
  // Arguments are passed without a shell so the URL can never be interpreted as a command.
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
    // Headless environments have no browser; the URL is printed for manual use.
    child.on('error', (): void => undefined);
    child.unref();
  } catch {
    // Same as above: opening the browser is a convenience, never a requirement.
  }
}

/** Pages live next to the compiled module in dist/, and under src/ when running tests. */
function resolvePagePath(pageName: string): string {
  const distPath = fileURLToPath(new URL(`./pages/${pageName}`, import.meta.url));
  if (existsSync(distPath)) return distPath;

  const srcPath = fileURLToPath(new URL(`../pages/${pageName}`, import.meta.url));
  if (existsSync(srcPath)) return srcPath;

  return distPath;
}

function renderLoginPage(): string {
  try {
    const pagePath = resolvePagePath('login.html');
    if (existsSync(pagePath)) {
      return readFileSync(pagePath, 'utf8');
    }
  } catch {
    // Fall back to the inline page below.
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

function renderSuccessPage(): string {
  try {
    const pagePath = resolvePagePath('success.html');
    if (existsSync(pagePath)) {
      return readFileSync(pagePath, 'utf8');
    }
  } catch {
    // Fall back to the inline page below.
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

async function authenticateViaBackend(
  apiUrl: string,
  email: string,
  password: string,
): Promise<LoginResult> {
  const loginRes = await fetchWithTimeout(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const errData = (await loginRes.json().catch((): unknown => null)) as {
      message?: unknown;
    } | null;
    const message = Array.isArray(errData?.message)
      ? errData.message.map(String).join(' ')
      : typeof errData?.message === 'string'
        ? errData.message
        : `HTTP ${loginRes.status}: Failed to sign in`;
    throw new Error(message.slice(0, 300));
  }

  const data = (await loginRes.json()) as {
    accessToken?: string;
    access_token?: string;
    token?: string;
    user?: SessionUser;
  };

  const token = data.accessToken || data.access_token || data.token;
  if (!token) {
    throw new Error('Server response did not include a valid access token');
  }
  return { token, user: data.user ?? { email } };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise<string>((resolve, reject): void => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer): void => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', (): void => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Serves the login page on 127.0.0.1 and resolves `sessionPromise` once the user signs
 * in. No CORS headers are sent: only the page served by this server may call /api/login.
 */
export function startLoginServer(
  apiUrl: string,
  preferredPort: number = 0,
  timeoutMs: number = LOGIN_TIMEOUT_MS,
): Promise<LoginServer> {
  let resolveSession!: (session: StoredSession) => void;
  let rejectSession!: (error: Error) => void;
  const sessionPromise = new Promise<StoredSession>((resolve, reject): void => {
    resolveSession = resolve;
    rejectSession = reject;
  });
  // Avoid an unhandled rejection if the caller never awaits the session.
  sessionPromise.catch((): void => undefined);

  let completed = false;

  const handleLogin = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let credentials: { email?: unknown; password?: unknown };
    try {
      credentials = JSON.parse(await readBody(req, MAX_LOGIN_BODY_BYTES)) as typeof credentials;
    } catch {
      sendJson(res, 400, { error: 'Invalid request body' });
      return;
    }
    const { email, password } = credentials ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      sendJson(res, 400, { error: 'Email and password are required' });
      return;
    }

    try {
      const { token, user } = await authenticateViaBackend(apiUrl, email, password);
      saveSession({ token, apiUrl, user });
      sendJson(res, 200, { success: true, user });
      completed = true;
      clearTimeout(timer);
      // Give the browser time to load /success before the server goes away.
      setTimeout((): void => {
        server.close();
        resolveSession({ token, apiUrl, user, savedAt: new Date().toISOString() });
      }, SERVER_CLOSE_DELAY_MS);
    } catch (error: unknown) {
      sendJson(res, 401, { error: errorMessage(error) });
    }
  };

  const server = createServer((req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');

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
    if (req.method === 'POST' && url.pathname === '/api/login' && !completed) {
      void handleLogin(req, res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  const timer = setTimeout((): void => {
    server.close();
    rejectSession(new Error(`No login completed within ${Math.round(timeoutMs / 60_000)} minutes`));
  }, timeoutMs);
  timer.unref();

  return new Promise<LoginServer>((resolveServer, rejectServer): void => {
    server.on('error', (error: Error): void => {
      clearTimeout(timer);
      rejectServer(error);
      rejectSession(error);
    });
    server.listen(preferredPort, '127.0.0.1', (): void => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : preferredPort;
      resolveServer({ server, port, sessionPromise });
    });
  });
}
