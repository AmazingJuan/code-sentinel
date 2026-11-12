// apps/frontend/src/__tests__/ScansView.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import type { ScanFiltersInterface } from '@/interfaces/ScanFiltersInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import ScansView from '@/views/ScansView.vue'

const project: ProjectInterface = {
  id: 'p1',
  name: 'code-sentinel',
  repo: 'git@github.com:code-sentinel/code-sentinel.git',
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

const scansFixture: ScanInterface[] = [
  {
    id: 'scan-1042',
    scanNumber: 1042,
    project,
    projectId: 'p1',
    date: '2026-08-12T00:00:00.000Z',
    status: 'completed',
    errorMessage: null,
    tools: ['SAST', 'Secret Scanner'],
    criticalCount: 1,
    highCount: 3,
    mediumCount: 5,
    lowCount: 2,
    totalCount: 11,
  },
  {
    id: 'scan-1039',
    scanNumber: 1039,
    project,
    projectId: 'p1',
    date: '2026-08-08T00:00:00.000Z',
    status: 'completed',
    errorMessage: null,
    tools: ['SAST', 'Secret Scanner'],
    criticalCount: 2,
    highCount: 4,
    mediumCount: 4,
    lowCount: 3,
    totalCount: 13,
  },
]

const getScans = vi.fn<(filters?: ScanFiltersInterface) => Promise<ScanInterface[]>>()

vi.mock('@/services/ScanService', () => ({
  ScanService: {
    getScans: (filters?: ScanFiltersInterface) => getScans(filters),
  },
}))

async function mountScansView(path = '/scans'): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/scans', name: 'scans', component: ScansView },
      { path: '/scan/:id', name: 'scan.show', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()

  return mount(ScansView, { global: { plugins: [router] } })
}

describe('ScansView (RF-028)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads scans and displays historical delta between completed runs of the same project', async () => {
    getScans.mockResolvedValueOnce(scansFixture)

    const wrapper = await mountScansView()
    await flushPromises()

    expect(getScans).toHaveBeenCalled()
    expect(wrapper.text()).toContain('#1042')
    expect(wrapper.text()).toContain('#1039')
    // 11 - 13 = -2 delta on scan #1042
    expect(wrapper.text()).toContain('-2')
  })

  it('shows the project summary banner when filtered by projectId', async () => {
    getScans.mockResolvedValueOnce(scansFixture)

    const wrapper = await mountScansView('/scans?projectId=p1')
    await flushPromises()

    expect(getScans).toHaveBeenCalledWith({ projectId: 'p1' })
    expect(wrapper.text()).toContain('Project Summary')
    expect(wrapper.text()).toContain('2 historical scans')
  })

  it('shows an error banner when loading scans fails', async () => {
    getScans.mockRejectedValueOnce(new Error('network error'))

    const wrapper = await mountScansView()
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load the scans.')
  })
})

