import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export interface ProjectInfo {
  id: string;
  name: string;
  repo: string;
  isNew: boolean;
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
      // Parse repo name from git url (e.g., git@github.com:org/repo.git or https://github.com/org/repo)
      const cleanUrl = gitUrl.replace(/\.git$/, '');
      const parts = cleanUrl.split(/[/:]/);
      const repoName = parts[parts.length - 1] || basename(resolvedPath);
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
      const name = pkg.name ? pkg.name.replace(/^@[^/]+\//, '') : '';
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

  // Check if a project with this name or repo already exists
  const existingMatch = existingProjects.find(
    (p) =>
      p.name.toLowerCase() === detected.name.toLowerCase() ||
      (detected.repo && p.repo.toLowerCase() === detected.repo.toLowerCase()),
  );

  if (existingMatch) {
    return {
      id: existingMatch.id,
      name: existingMatch.name,
      repo: existingMatch.repo,
      isNew: false,
    };
  }

  // Automatically register the project in Code Sentinel
  const createRes = await fetch(`${apiUrl}/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: detected.name,
      repo: detected.repo,
      tools: ['Semgrep', 'Port Scanner'],
    }),
  });

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

