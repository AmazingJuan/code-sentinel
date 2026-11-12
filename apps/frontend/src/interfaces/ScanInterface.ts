// apps/frontend/src/interfaces/ScanInterface.ts
import type { ProjectInterface } from './ProjectInterface'

// RF-006: same lifecycle as the backend (pending → running → completed | failed).
export const SCAN_STATUSES = ['pending', 'running', 'completed', 'failed'] as const
export type ScanStatus = (typeof SCAN_STATUSES)[number]

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

export type ScanTool = 'SAST' | 'Secret Scanner' | 'Port Scanner'
export const SCAN_TOOLS: ScanTool[] = ['SAST', 'Secret Scanner', 'Port Scanner']

export interface ScanInterface {
  id: string
  scanNumber: number
  project: ProjectInterface
  projectId: string
  date: string
  status: ScanStatus
  errorMessage?: string | null
  tools: ScanTool[]
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  totalCount: number
}

export interface ProjectScanSummaryInterface {
  projectId: string
  projectName: string
  status: ScanStatus
  lastScan: string | null
  scanCount: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  totalCount: number
}

/**
 * RF-028 / RF-029: derives per-project overview counters and historical
 * summaries from the list of scans.
 */
export function computeProjectSummariesFromScans(
  scans: ScanInterface[],
): ProjectScanSummaryInterface[] {
  const byProject = new Map<string, ScanInterface[]>()
  for (const scan of scans) {
    const group = byProject.get(scan.projectId) ?? []
    group.push(scan)
    byProject.set(scan.projectId, group)
  }

  const summaries: ProjectScanSummaryInterface[] = []
  for (const [projectId, projectScans] of byProject.entries()) {
    const sorted = [...projectScans].sort((a, b) => b.scanNumber - a.scanNumber)
    const latest = sorted[0]
    if (!latest) continue
    const latestCompleted = sorted.find((s) => s.status === 'completed')
    const criticalCount = latestCompleted?.criticalCount ?? 0
    const highCount = latestCompleted?.highCount ?? 0
    const mediumCount = latestCompleted?.mediumCount ?? 0
    const lowCount = latestCompleted?.lowCount ?? 0

    summaries.push({
      projectId,
      projectName: latest.project?.name ?? projectId,
      status: latest.status,
      lastScan: latest.date ?? null,
      scanCount: sorted.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      totalCount:
        latestCompleted?.totalCount ??
        criticalCount + highCount + mediumCount + lowCount,
    })
  }

  return summaries.sort((a, b) => a.projectName.localeCompare(b.projectName))
}