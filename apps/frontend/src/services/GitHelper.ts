// apps/frontend/src/services/GitHelper.ts

export function formatCommitSha(commitSha?: string | null): string {
  if (!commitSha) return 'Unknown'
  return commitSha.length > 7 ? commitSha.slice(0, 7) : commitSha
}

export function parseWebRepoUrl(rawRepoUrl?: string | null): string | null {
  if (!rawRepoUrl || typeof rawRepoUrl !== 'string') return null
  const trimmed = rawRepoUrl.trim().replace(/\.git$/i, '')

  // 1. HTTPS or HTTP URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  // 2. SSH URL format (e.g. git@github.com:owner/repo or git@gitlab.com:owner/repo)
  const scpMatch = trimmed.match(/^[\w.-]+@([\w.-]+):(.+)$/)
  if (scpMatch && scpMatch[1] && scpMatch[2]) {
    const host = scpMatch[1]
    const path = scpMatch[2].replace(/^\//, '')
    return `https://${host}/${path}`
  }

  return null
}

export function buildCommitUrl(repoUrl?: string | null, commitSha?: string | null): string | null {
  const base = parseWebRepoUrl(repoUrl)
  if (!base || !commitSha) return null
  return `${base}/commit/${commitSha}`
}

export function buildFileDeepLink(
  repoUrl?: string | null,
  filePath?: string | null,
  line?: number | null,
  ref: string = 'main',
): string | null {
  const base = parseWebRepoUrl(repoUrl)
  if (!base || !filePath) return null
  const cleanPath = filePath.replace(/^\.?\//, '')
  const lineSuffix = line ? `#L${line}` : ''
  return `${base}/blob/${ref}/${cleanPath}${lineSuffix}`
}
