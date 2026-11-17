import { describe, expect, it } from 'vitest'

import {
  buildCommitUrl,
  buildFileDeepLink,
  formatCommitSha,
  parseWebRepoUrl,
} from '@/services/GitHelper'

describe('GitHelper', () => {
  it('formats commit SHA correctly', () => {
    expect(formatCommitSha('a1b2c3d4e5f67890')).toBe('a1b2c3d')
    expect(formatCommitSha('short')).toBe('short')
    expect(formatCommitSha(null)).toBe('Unknown')
    expect(formatCommitSha(undefined)).toBe('Unknown')
  })

  it('normalizes repository web URLs for HTTPS and SSH', () => {
    expect(parseWebRepoUrl('https://github.com/org/repo.git')).toBe(
      'https://github.com/org/repo'
    )
    expect(parseWebRepoUrl('git@github.com:org/repo.git')).toBe(
      'https://github.com/org/repo'
    )
    expect(parseWebRepoUrl('git@gitlab.com:team/subgroup/project.git')).toBe(
      'https://gitlab.com/team/subgroup/project'
    )
    expect(parseWebRepoUrl(null)).toBe(null)
  })

  it('generates commit URLs', () => {
    const repo = 'git@github.com:org/repo.git'
    const sha = 'a1b2c3d4e5f67890'
    expect(buildCommitUrl(repo, sha)).toBe(
      'https://github.com/org/repo/commit/a1b2c3d4e5f67890'
    )
    expect(buildCommitUrl(null, sha)).toBe(null)
    expect(buildCommitUrl(repo, null)).toBe(null)
  })

  it('generates file deep links with line number', () => {
    const repo = 'https://github.com/org/repo'
    expect(buildFileDeepLink(repo, 'src/api/auth.ts', 42, 'main')).toBe(
      'https://github.com/org/repo/blob/main/src/api/auth.ts#L42'
    )
    expect(buildFileDeepLink(repo, null)).toBe(null)
  })
})
