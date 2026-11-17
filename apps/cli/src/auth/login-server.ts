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
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Sentinel - CLI Authentication</title>
  <style>
    body { background: #090d16; color: #f3f4f6; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #111827; border: 1px solid #1f293d; border-radius: 12px; padding: 2.25rem; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #9ca3af; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; margin-bottom: 0.5rem; }
    input { width: 100%; box-sizing: border-box; background: #060911; border: 1px solid #1f293d; border-radius: 6px; padding: 0.7rem; color: #fff; margin-bottom: 1rem; }
    button { width: 100%; background: #10b981; color: #04100c; font-weight: 600; border: none; border-radius: 6px; padding: 0.75rem; cursor: pointer; }
    .alert { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Code Sentinel</h2>
    <p>Inicia sesión para autorizar la CLI de Code Sentinel.</p>
    <div id="error" class="alert"></div>
    <form id="form">
      <label>Correo electrónico</label>
      <input id="email" type="email" required />
      <label>Contraseña</label>
      <input id="password" type="password" required />
      <button id="btn" type="submit">Iniciar sesión</button>
    </form>
  </div>
  <script>
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      btn.disabled = true;
      btn.innerText = 'Verificando...';
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
          document.getElementById('error').innerText = data.error || 'Credenciales incorrectas.';
          document.getElementById('error').style.display = 'block';
          btn.disabled = false;
          btn.innerText = 'Iniciar sesión';
        }
      } catch (err) {
        document.getElementById('error').innerText = err.message;
        document.getElementById('error').style.display = 'block';
        btn.disabled = false;
        btn.innerText = 'Iniciar sesión';
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
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Code Sentinel - Autenticación Exitosa</title>
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
    <h2>Autenticación exitosa</h2>
    <p>La sesión para Code Sentinel CLI ha sido autorizada correctamente.</p>
    <div class="hint">Ya puedes cerrar esta ventana y regresar a tu terminal.</div>
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
    const errData = await loginRes.json().catch(() => ({ message: 'Credenciales incorrectas' }));
    const message = Array.isArray(errData?.message)
      ? errData.message.join(' ')
      : errData?.message || `HTTP ${loginRes.status}: Error al iniciar sesión`;
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
    throw new Error('La respuesta del servidor no incluyó un token de acceso válido');
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
                res.end(JSON.stringify({ error: 'Correo y contraseña requeridos' }));
                return;
              }

              const { token, user } = await authenticateViaBackend(apiUrl, email, password);

              saveSession({ token, apiUrl, user });

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, user }));

              // Permitir que el navegador complete la redirección a /success antes de cerrar
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
