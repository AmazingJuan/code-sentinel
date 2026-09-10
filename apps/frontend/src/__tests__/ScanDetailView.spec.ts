import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import ScanDetailView from '@/views/ScanDetailView.vue'

const project: ProjectInterface = {
  id: 'project-1',
  name: 'payments-service',
  repo: 'git@github.com:org/payments-service.git',
  tools: ['SAST'],
  status: 'completed',
  lastScan: '2026-08-12T00:00:00.000Z',
  criticalCount: 1,
  highCount: 1,
  mediumCount: 0,
  lowCount: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  userId: 'user-1',
}

const scan: ScanInterface = {
  id: 'scan-1',
  scanNumber: 1042,
  project,
  projectId: 'project-1',
  date: '2026-08-12T00:00:00.000Z',
  status: 'completed',
  tools: ['SAST', 'Secret Scanner'],
  criticalCount: 1,
  highCount: 1,
  mediumCount: 0,
  lowCount: 0,
  totalCount: 2,
}

const finding: FindingInterface = {
  id: 'finding-1',
  scanId: 'scan-1',
  type: 'Hardcoded Secret',
  severity: 'critical',
  filePath: 'src/config.js',
  line: 12,
  sourceTool: 'Secret Scanner',
  description: 'API key exposed in plain text.',
  recommendation: 'Move it to environment variables.',
}

const getScanById = vi.fn<(id: string) => Promise<ScanInterface>>()
const getFindings = vi.fn<(filters: FindingFiltersInterface) => Promise<FindingInterface[]>>()

vi.mock('@/services/ScanService', () => ({
  ScanService: {
    getScanById: (id: string) => getScanById(id),
  },
}))

vi.mock('@/services/FindingService', () => ({
  FindingService: {
    getFindings: (filters: FindingFiltersInterface) => getFindings(filters),
  },
}))

async function mountScanDetailView(): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/scan/:id', name: 'scan.show', component: { template: '<div />' } }],
  })
  await router.push('/scan/scan-1')
  await router.isReady()

  return mount(ScanDetailView, { global: { plugins: [router] } })
}

describe('ScanDetailView', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the scan and displays its findings and relevant information', async () => {
    getScanById.mockResolvedValueOnce(scan)
    getFindings.mockResolvedValueOnce([finding])

    const wrapper = await mountScanDetailView()
    await flushPromises()

    expect(getScanById).toHaveBeenCalledWith('scan-1')
    expect(getFindings).toHaveBeenCalledWith({ scanId: 'scan-1' })
    expect(wrapper.text()).toContain('#1042')
    expect(wrapper.text()).toContain('payments-service')
    expect(wrapper.text()).toContain('Hardcoded Secret')
    expect(wrapper.text()).toContain('src/config.js:12')
  })

  it('shows an empty state when the scan has no findings', async () => {
    getScanById.mockResolvedValueOnce(scan)
    getFindings.mockResolvedValueOnce([])

    const wrapper = await mountScanDetailView()
    await flushPromises()

    expect(wrapper.text()).toContain('No findings for this scan.')
  })

  it('shows a permission-denied message when access is forbidden', async () => {
    getScanById.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } })

    const wrapper = await mountScanDetailView()
    await flushPromises()

    expect(wrapper.text()).toContain('You do not have access to this scan.')
  })

  it('shows a generic error message for other failures', async () => {
    getScanById.mockRejectedValueOnce(new Error('network error'))

    const wrapper = await mountScanDetailView()
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load the details for this scan.')
  })
})
