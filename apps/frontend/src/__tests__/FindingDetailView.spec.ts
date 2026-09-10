import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { FindingInterface } from '@/interfaces/FindingInterface'
import FindingDetailView from '@/views/FindingDetailView.vue'

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

const getFindingById = vi.fn<(id: string) => Promise<FindingInterface>>()

vi.mock('@/services/FindingService', () => ({
  FindingService: {
    getFindingById: (id: string) => getFindingById(id),
  },
}))

async function mountFindingDetailView(): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/finding/:id', name: 'finding.show', component: { template: '<div />' } }],
  })
  await router.push('/finding/finding-1')
  await router.isReady()

  return mount(FindingDetailView, { global: { plugins: [router] } })
}

describe('FindingDetailView', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads and displays the finding details', async () => {
    getFindingById.mockResolvedValueOnce(finding)

    const wrapper = await mountFindingDetailView()
    await flushPromises()

    expect(getFindingById).toHaveBeenCalledWith('finding-1')
    expect(wrapper.text()).toContain('Hardcoded Secret')
    expect(wrapper.text()).toContain('src/config.js:12')
    expect(wrapper.text()).toContain('API key exposed in plain text.')
    expect(wrapper.text()).toContain('Move it to environment variables.')
    expect(wrapper.text()).toContain('Secret Scanner')
  })

  it('shows a permission-denied message when access is forbidden', async () => {
    getFindingById.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } })

    const wrapper = await mountFindingDetailView()
    await flushPromises()

    expect(wrapper.text()).toContain('You do not have access to this finding.')
  })

  it('shows a generic error message for other failures', async () => {
    getFindingById.mockRejectedValueOnce(new Error('network error'))

    const wrapper = await mountFindingDetailView()
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load this finding.')
  })
})
