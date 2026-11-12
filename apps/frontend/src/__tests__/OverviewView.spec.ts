import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import { computeProjectSummariesFromScans } from '@/interfaces/ScanInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import OverviewView from '@/views/OverviewView.vue'

const projectA: ProjectInterface = {
  id: 'p1',
  name: 'code-sentinel',
  repo: 'git@github.com:org/code-sentinel.git',
  tools: ['SAST', 'Secret Scanner'],
  status: 'completed',
  lastScan: '2026-08-12T00:00:00.000Z',
  criticalCount: 1,
  highCount: 3,
  mediumCount: 5,
  lowCount: 2,
  createdAt: '2026-08-01T00:00:00.000Z',
  userId: 'u1',
}

const projectB: ProjectInterface = {
  id: 'p2',
  name: 'backend-api',
  repo: 'git@github.com:org/backend-api.git',
  tools: ['SAST'],
  status: 'completed',
  lastScan: '2026-08-11T00:00:00.000Z',
  criticalCount: 2,
  highCount: 6,
  mediumCount: 9,
  lowCount: 4,
  createdAt: '2026-08-01T00:00:00.000Z',
  userId: 'u1',
}

const scans: ScanInterface[] = [
  {
    id: 's3',
    scanNumber: 1043,
    project: projectA,
    projectId: 'p1',
    date: '2026-08-13T00:00:00.000Z',
    status: 'running',
    tools: ['SAST', 'Secret Scanner'],
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    totalCount: 0,
  },
  {
    id: 's2',
    scanNumber: 1042,
    project: projectA,
    projectId: 'p1',
    date: '2026-08-12T00:00:00.000Z',
    status: 'completed',
    tools: ['SAST', 'Secret Scanner'],
    criticalCount: 1,
    highCount: 3,
    mediumCount: 5,
    lowCount: 2,
    totalCount: 11,
  },
  {
    id: 's1',
    scanNumber: 1041,
    project: projectB,
    projectId: 'p2',
    date: '2026-08-11T00:00:00.000Z',
    status: 'completed',
    tools: ['SAST'],
    criticalCount: 2,
    highCount: 6,
    mediumCount: 9,
    lowCount: 4,
    totalCount: 21,
  },
]

const findings: FindingInterface[] = [
  {
    id: 'f1',
    scanId: 's2',
    type: 'Hardcoded Secret',
    severity: 'critical',
    toolCategory: 'Secret Scanner',
    filePath: 'src/config.js',
    line: 12,
    sourceTool: 'Gitleaks',
    description: 'API key exposed.',
    recommendation: 'Move to env.',
  },
]

const getScans = vi.fn<() => Promise<ScanInterface[]>>()
const getFindings = vi.fn<() => Promise<FindingInterface[]>>()

vi.mock('@/services/ScanService', () => ({
  ScanService: {
    getScans: () => getScans(),
  },
}))

vi.mock('@/services/FindingService', () => ({
  FindingService: {
    getFindings: () => getFindings(),
  },
}))

async function mountOverviewView(): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'overview', component: { template: '<div />' } },
      { path: '/projects', name: 'project.index', component: { template: '<div />' } },
      { path: '/scans', name: 'scan.index', component: { template: '<div />' } },
      { path: '/scans/:id', name: 'scan.show', component: { template: '<div />' } },
      { path: '/findings', name: 'finding.index', component: { template: '<div />' } },
      { path: '/findings/:id', name: 'finding.show', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  return mount(OverviewView, { global: { plugins: [router] } })
}

describe('OverviewView (RF-028, RF-029)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calculates per-project summaries from scans', () => {
    const summaries = computeProjectSummariesFromScans(scans)

    expect(summaries).toHaveLength(2)
    const codeSentinel = summaries.find((s) => s.projectId === 'p1')
    expect(codeSentinel?.criticalCount).toBe(1)
    expect(codeSentinel?.highCount).toBe(3)
    expect(codeSentinel?.totalCount).toBe(11)
    expect(codeSentinel?.scanCount).toBe(2)
  })

  it('renders the projects security overview and filters by selected project', async () => {
    getScans.mockResolvedValueOnce(scans)
    getFindings.mockResolvedValueOnce(findings)

    const wrapper = await mountOverviewView()
    await flushPromises()

    expect(wrapper.text()).toContain('Projects Security Overview')
    expect(wrapper.text()).toContain('code-sentinel')
    expect(wrapper.text()).toContain('backend-api')

    await wrapper.find('select').setValue('p1')
    await flushPromises()

    expect(wrapper.text()).toContain('selected project')
  })
})

