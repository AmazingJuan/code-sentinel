import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export interface ProjectInfo {
  id: string;
  name: string;
  repo: string;
  isNew: boolean;
}

export function extractCanonicalSlug(gitUrl: string): string | null {
  if (!gitUrl || typeof gitUrl !== 'string') return null;
  const cleanUrl = gitUrl.trim().replace(/\.git$/i, '');
  if (!cleanUrl) return null;

  // Case 1: Standard URL (http, https, ssh)
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
      // Fall through to regex parsing
    }
  }

  // Case 2: SCP-style SSH url (e.g. git@github.com:owner/repo)
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

  // Case 3: Split by / and :
  const parts = cleanUrl.split(/[/:]/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join('/');
  }

  return null;
}

export function detectLocalProjectIdentity(targetPath: string): { name: string; repo: string } {
  const resolvedPath = resolve(targetPath);

  // 1. Try Git remote origin detection
  try {
    const gitUrl = execSync('git config --get remote.origin.url', {
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
    // Not a git repository or no remote origin
  }

  // 2. Try package.json detection
  try {
    const pkgPath = resolve(resolvedPath, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; repository?: string | { url?: string } };
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
    // Ignore package.json parsing errors
  }

  // 3. Fallback to folder name
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

  // 1. Fetch user's existing projects
  const listRes = await fetch(`${apiUrl}/projects`, { headers });
  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Failed to list projects (HTTP ${listRes.status}): ${errText}`);
  }

  const existingProjects = (await listRes.json()) as Array<{ id: string; name: string; repo: string }>;

  // 2. Handle explicit project flag
  if (explicitProject && explicitProject.trim().length > 0) {
    const query = explicitProject.trim().toLowerCase();
    const matched = existingProjects.find(
      (p) => p.id.toLowerCase() === query || p.name.toLowerCase() === query,
    );

    if (matched) {
      return { id: matched.id, name: matched.name, repo: matched.repo, isNew: false };
    }

    // If query is already a valid UUID, allow direct binding
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(explicitProject.trim())) {
      return { id: explicitProject.trim(), name: explicitProject.trim(), repo: explicitProject.trim(), isNew: false };
    }

    throw new Error(
      `Project "${explicitProject}" was not found among your assigned projects. Available projects: ${
        existingProjects.map((p) => p.name).join(', ') || 'None'
      }`,
    );
  }

  // 3. Automatic detection and zero-touch registration (RF-038)
  const detected = detectLocalProjectIdentity(targetPath);
  const dName = detected.name.toLowerCase();
  const dRepo = (detected.repo || '').toLowerCase();

  // Check if an assigned project matches canonical name, repo, or user-scoped variant
  const existingMatch = existingProjects.find((p) => {
    const pName = p.name.toLowerCase();
    const pRepo = (p.repo || '').toLowerCase();
    return (
      pName === dName ||
      (dRepo.length > 0 && pRepo === dRepo) ||
      pName.startsWith(`${dName} (`)
    );
  });

  if (existingMatch) {
    return {
      id: existingMatch.id,
      name: existingMatch.name,
      repo: existingMatch.repo,
      isNew: false,
    };
  }

  // Helper to resolve user slug for isolation fallback
  const resolveUserSlug = async (): Promise<string> => {
    if (userEmail && userEmail.trim().length > 0) {
      return userEmail.split('@')[0].trim().toLowerCase() || 'user';
    }
    try {
      const meRes = await fetch(`${apiUrl}/auth/me`, { headers });
      if (meRes.ok) {
        const me = (await meRes.json()) as { email?: string; name?: string };
        const identifier = me.email || me.name;
        if (identifier) {
          return identifier.split('@')[0].trim().toLowerCase() || 'user';
        }
      }
    } catch {
      // Ignore /auth/me lookup failures
    }
    return 'user';
  };

  const registerProject = async (name: string): Promise<Response> => {
    return fetch(`${apiUrl}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: name.slice(0, 120),
        repo: detected.repo.slice(0, 500),
      }),
    });
  };

  // Attempt 1: Register with canonical name
  let createRes = await registerProject(detected.name);

  // If 409 Conflict: Project exists in platform but requester is not assigned to it.
  // Fall back to creating a personal/isolated project assigned to this user.
  if (createRes.status === 409) {
    const userSlug = await resolveUserSlug();
    const qualifiedName = `${detected.name} (${userSlug})`.slice(0, 120);
    createRes = await registerProject(qualifiedName);

    // If still conflict, append a unique short suffix
    if (createRes.status === 409) {
      const uniqueSuffix = Date.now().toString(36).slice(-4);
      const uniqueName = `${detected.name} (${userSlug}-${uniqueSuffix})`.slice(0, 120);
      createRes = await registerProject(uniqueName);
    }
  }

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to auto-register project "${detected.name}" (HTTP ${createRes.status}): ${errText}`);
  }

  const createdProject = (await createRes.json()) as { id: string; name: string; repo: string };
  return {
    id: createdProject.id,
    name: createdProject.name,
    repo: createdProject.repo,
    isNew: true,
  };
}

