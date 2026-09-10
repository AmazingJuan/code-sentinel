import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import type { CreateProjectDto } from '@/services/ProjectService'
import ProjectsView from '@/views/ProjectsView.vue'

const project: ProjectInterface = {
  id: 'project-1',
  name: 'payments-service',
  repo: 'git@github.com:org/payments-service.git',
  tools: ['SAST', 'Secret Scanner', 'Port Scanner'],
  status: 'pending',
  lastScan: null,
  criticalCount: 0,
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  userId: 'user-1',
}

const getProjects = vi.fn<() => Promise<ProjectInterface[]>>()
const createProject = vi.fn<(payload: CreateProjectDto) => Promise<ProjectInterface>>()

vi.mock('@/services/ProjectService', () => ({
  ProjectService: {
    getProjects: () => getProjects(),
    createProject: (payload: CreateProjectDto) => createProject(payload),
  },
}))

async function mountProjectsView(): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'project.index', component: { template: '<div />' } },
      { path: '/projects/:id', name: 'project.show', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  return mount(ProjectsView, { global: { plugins: [router] } })
}

describe('ProjectsView', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('lists the registered projects on mount', async () => {
    getProjects.mockResolvedValueOnce([project])

    const wrapper = await mountProjectsView()
    await flushPromises()

    expect(getProjects).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('payments-service')
    expect(wrapper.text()).toContain('1 project')
  })

  it('shows an empty state when no projects are registered', async () => {
    getProjects.mockResolvedValueOnce([])

    const wrapper = await mountProjectsView()
    await flushPromises()

    expect(wrapper.text()).toContain('No projects have been registered yet')
  })

  it('registers a project and prepends it to the list', async () => {
    getProjects.mockResolvedValueOnce([])
    createProject.mockResolvedValueOnce(project)

    const wrapper = await mountProjectsView()
    await flushPromises()

    await wrapper.find('#project-name').setValue('payments-service')
    await wrapper.find('#project-repo').setValue('git@github.com:org/payments-service.git')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(createProject).toHaveBeenCalledWith({
      name: 'payments-service',
      repo: 'git@github.com:org/payments-service.git',
    })
    expect(wrapper.text()).toContain('registered successfully')
    expect(wrapper.text()).toContain('payments-service')
  })

  it('shows an error message when loading projects fails', async () => {
    getProjects.mockRejectedValueOnce(new Error('network error'))

    const wrapper = await mountProjectsView()
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load the registered projects')
  })
})
