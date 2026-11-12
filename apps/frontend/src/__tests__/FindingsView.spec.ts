// apps/frontend/src/__tests__/FindingsView.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import SeverityBadge from '@/components/SeverityBadge.vue'
import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import FindingsView from '@/views/FindingsView.vue'

const findingsFixture: FindingInterface[] = [
  {
    id: 'f1',
    scanId: 's1',
    type: 'Hardcoded Secret',
    severity: 'critical',
    toolCategory: 'Secret Scanner',
    sourceTool: 'Gitleaks',
    filePath: 'src/config.ts',
    line: 12,
    description: 'API key exposed.',
    recommendation: 'Move to env.',
  },
  {
    id: 'f2',
    scanId: 's1',
    type: 'Open Port 8080',
    severity: null,
    toolCategory: 'Port Scanner',
    sourceTool: 'CodeSentinel',
    filePath: null,
    line: null,
    description: 'Open port.',
    recommendation: 'Close port.',
  },
]

const getFindings = vi.fn<(filters?: FindingFiltersInterface) => Promise<FindingInterface[]>>()

vi.mock('@/services/FindingService', () => ({
  FindingService: {
    getFindings: (filters?: FindingFiltersInterface) => getFindings(filters),
  },
}))

async function mountFindingsView(): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/findings', name: 'findings', component: FindingsView },
      { path: '/finding/:id', name: 'finding.show', component: { template: '<div />' } },
    ],
  })
  await router.push('/findings')
  await router.isReady()

  return mount(FindingsView, { global: { plugins: [router] } })
}

describe('FindingsView & SeverityBadge (RF-019, RF-021, RF-022)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads and displays findings with real sourceTool and optional location/severity', async () => {
    getFindings.mockResolvedValueOnce(findingsFixture)

    const wrapper = await mountFindingsView()
    await flushPromises()

    expect(wrapper.text()).toContain('Hardcoded Secret')
    expect(wrapper.text()).toContain('Gitleaks')
    expect(wrapper.text()).toContain('Open Port 8080')
    expect(wrapper.text()).toContain('CodeSentinel')
    expect(wrapper.text()).toContain('unclassified')
  })

  it('displays an error message when loading findings fails', async () => {
    getFindings.mockRejectedValueOnce(new Error('network error'))

    const wrapper = await mountFindingsView()
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load the findings.')
  })

  it.each([
    ['critical', 'critical'],
    ['high', 'high'],
    ['medium', 'medium'],
    ['low', 'low'],
    [null, 'unclassified'],
  ] as const)('SeverityBadge renders %s as %s', (severity, expectedText) => {
    const wrapper = mount(SeverityBadge, { props: { severity } })
    expect(wrapper.text()).toBe(expectedText)
  })
})
