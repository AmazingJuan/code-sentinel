import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { fetchWithTimeout, readErrorDetail } from '../backend/http.js';

export interface ProjectInfo {
  id: string;
  name: string;
  repo: string;
  isNew: boolean;
  tools?: string[];
}

function normalizeTools(tools: unknown): string[] | undefined {
  if (Array.isArray(tools)) {
    const list = tools.map((t) => String(t).trim()).filter(Boolean);
    return list.length > 0 ? list : undefined;
  }
  if (typeof tools === 'string' && tools.trim().length > 0) {
    const list = tools
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

export function extractCanonicalSlug(gitUrl: string): string | null {
  if (!gitUrl || typeof gitUrl !== 'string') return null;
  const cleanUrl = gitUrl.trim().replace(/\.git$/i, '');
  if (!cleanUrl) return null;

  if (cleanUrl.includes('://')) {
    try {
      const parsed = new URL(cleanUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        return segments.slice(-2).join('/');
      }
      if (segments.length === 1) {
        return segments[0];
      }
    } catch {
      // Not a parseable URL: try the SCP-style form below.
    }
  }

  // SCP-style SSH remote, e.g. git@github.com:owner/repo
  const scpMatch = cleanUrl.match(/^[\w.-]+@[\w.-]+:(.+)$/);
  if (scpMatch) {
    const segments = scpMatch[1].split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments.slice(-2).join('/');
    }
    if (segments.length === 1) {
      return segments[0];
    }
  }

  const parts = cleanUrl.split(/[/:]/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join('/');
  }

  return null;
}

export function detectLocalProjectIdentity(targetPath: string): { name: string; repo: string } {
  const resolvedPath = resolve(targetPath);

  // Identity precedence: Git origin remote, then package.json name, then folder name.
  try {
    const gitUrl = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: resolvedPath,
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();

    if (gitUrl.length > 0) {
      const canonicalSlug = extractCanonicalSlug(gitUrl);
      const repoName = canonicalSlug || basename(resolvedPath);
      return {
        name: repoName,
        repo: gitUrl,
      };
    }
  } catch {
    // Not a git repository or no origin remote.
  }

  try {
    const pkgPath = resolve(resolvedPath, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        name?: string;
        repository?: string | { url?: string };
      };
      const name = pkg.name ? pkg.name.replace(/^@/, '') : '';
      let repo = '';
      if (typeof pkg.repository === 'string') {
        repo = pkg.repository;
      } else if (pkg.repository && typeof pkg.repository.url === 'string') {
        repo = pkg.repository.url;
      }
      if (name.length > 0) {
        return {
          name,
          repo: repo.length > 0 ? repo : `local://${name}`,
        };
      }
    }
  } catch {
    // Unreadable package.json: fall back to the folder name.
  }

  const folderName = basename(resolvedPath) || 'unnamed-project';
  return {
    name: folderName,
    repo: `local://${folderName}`,
  };
}

export async function resolveOrCreateProject(
  apiUrl: string,
  token: string,
  targetPath: string,
  explicitProject?: string,
  userEmail?: string,
): Promise<ProjectInfo> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const listRes = await fetchWithTimeout(`${apiUrl}/projects`, { headers });
  if (!listRes.ok) {
    throw new Error(
      `Failed to list projects (HTTP ${listRes.status}): ${await readErrorDetail(listRes)}`,
    );
  }

  const existingProjects = (await listRes.json()) as Array<{
    id: string;
    name: string;
    repo: string;
    tools?: unknown;
  }>;

  if (explicitProject && explicitProject.trim().length > 0) {
    const query = explicitProject.trim().toLowerCase();
    const matched = existingProjects.find(
      (p) => p.id.toLowerCase() === query || p.name.toLowerCase() === query,
    );

    if (matched) {
      return {
        id: matched.id,
        name: matched.name,
        repo: matched.repo,
        isNew: false,
        tools: normalizeTools(matched.tools),
      };
    }

    // A UUID may belong to a project the list endpoint does not return; bind to it directly.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(explicitProject.trim())) {
      const projId = explicitProject.trim();
      let tools: string[] | undefined;
      try {
        const getRes = await fetchWithTimeout(`${apiUrl}/projects/${projId}`, { headers });
        if (getRes.ok) {
          const p = (await getRes.json()) as { name?: string; repo?: string; tools?: unknown };
          return {
            id: projId,
            name: p.name || projId,
            repo: p.repo || projId,
            isNew: false,
            tools: normalizeTools(p.tools),
          };
        }
      } catch {
        // Metadata is optional; the backend still authorizes the scan by project id.
      }
      return { id: projId, name: projId, repo: projId, isNew: false, tools };
    }

    throw new Error(
      `Project "${explicitProject}" was not found among your assigned projects. Available projects: ${
        existingProjects.map((p) => p.name).join(', ') || 'None'
      }`,
    );
  }

  // Zero-touch registration (RF-038).
  const detected = detectLocalProjectIdentity(targetPath);
  const dName = detected.name.toLowerCase();
  const dRepo = (detected.repo || '').toLowerCase();

  // Also matches the user-scoped variant "<name> (<user>)" created after a 409 below.
  const existingMatch = existingProjects.find((p) => {
    const pName = p.name.toLowerCase();
    const pRepo = (p.repo || '').toLowerCase();
    return (
      pName === dName || (dRepo.length > 0 && pRepo === dRepo) || pName.startsWith(`${dName} (`)
    );
  });

  if (existingMatch) {
    return {
      id: existingMatch.id,
      name: existingMatch.name,
      repo: existingMatch.repo,
      isNew: false,
      tools: normalizeTools(existingMatch.tools),
    };
  }

  const resolveUserSlug = async (): Promise<string> => {
    if (userEmail && userEmail.trim().length > 0) {
      return userEmail.split('@')[0].trim().toLowerCase() || 'user';
    }
    try {
      const meRes = await fetchWithTimeout(`${apiUrl}/auth/me`, { headers });
      if (meRes.ok) {
        const me = (await meRes.json()) as { email?: string; name?: string };
        const identifier = me.email || me.name;
        if (identifier) {
          return identifier.split('@')[0].trim().toLowerCase() || 'user';
        }
      }
    } catch {
      // Fall back to the generic slug.
    }
    return 'user';
  };

  const registerProject = async (name: string): Promise<Response> => {
    return fetchWithTimeout(`${apiUrl}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: name.slice(0, 120),
        repo: detected.repo.slice(0, 500),
      }),
    });
  };

  let createRes = await registerProject(detected.name);

  // 409: the project exists but is not assigned to this user, so register a user-scoped one.
  if (createRes.status === 409) {
    const userSlug = await resolveUserSlug();
    const qualifiedName = `${detected.name} (${userSlug})`.slice(0, 120);
    createRes = await registerProject(qualifiedName);

    if (createRes.status === 409) {
      const uniqueSuffix = Date.now().toString(36).slice(-4);
      const uniqueName = `${detected.name} (${userSlug}-${uniqueSuffix})`.slice(0, 120);
      createRes = await registerProject(uniqueName);
    }
  }

  if (!createRes.ok) {
    throw new Error(
      `Failed to auto-register project "${detected.name}" (HTTP ${createRes.status}): ${await readErrorDetail(createRes)}`,
    );
  }

  const createdProject = (await createRes.json()) as {
    id: string;
    name: string;
    repo: string;
    tools?: unknown;
  };
  return {
    id: createdProject.id,
    name: createdProject.name,
    repo: createdProject.repo,
    isNew: true,
    tools: normalizeTools(createdProject.tools),
  };
}
