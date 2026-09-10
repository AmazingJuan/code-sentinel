import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import type { UpdateProjectDto } from '@/services/ProjectService'
import ProjectDetailView from '@/views/ProjectDetailView.vue'

const project: ProjectInterface = {
  id: 'project-1',
  name: 'payments-service',
  repo: 'git@github.com:org/payments-service.git',
  tools: ['SAST'],
  status: 'pending',
  lastScan: null,
  criticalCount: 0,
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  userId: 'user-1',
}

const getProjectById = vi.fn<(id: string) => Promise<ProjectInterface>>()
const updateProject = vi.fn<(id: string, payload: UpdateProjectDto) => Promise<ProjectInterface>>()

vi.mock('@/services/ProjectService', () => ({
  ProjectService: {
    getProjectById: (id: string) => getProjectById(id),
    updateProject: (id: string, payload: UpdateProjectDto) => updateProject(id, payload),
  },
}))

async function mountProjectDetailView(): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects', name: 'project.index', component: { template: '<div />' } },
      { path: '/projects/:id', name: 'project.show', component: { template: '<div />' } },
    ],
  })
  await router.push('/projects/project-1')
  await router.isReady()

  return mount(ProjectDetailView, { global: { plugins: [router] } })
}

describe('ProjectDetailView', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the project and pre-fills the configuration form', async () => {
    getProjectById.mockResolvedValueOnce(project)

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    expect(getProjectById).toHaveBeenCalledWith('project-1')
    expect(wrapper.text()).toContain('payments-service')
    expect((wrapper.find('#project-repo').element as HTMLInputElement).value).toBe(project.repo)
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('saves the updated configuration', async () => {
    getProjectById.mockResolvedValueOnce(project)
    updateProject.mockResolvedValueOnce({ ...project, repo: 'git@github.com:org/renamed.git', tools: ['SAST', 'Secret Scanner'] })

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    await wrapper.find('#project-repo').setValue('git@github.com:org/renamed.git')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[1]?.setValue(true)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updateProject).toHaveBeenCalledWith('project-1', {
      repo: 'git@github.com:org/renamed.git',
      tools: ['SAST', 'Secret Scanner'],
    })
    expect(wrapper.text()).toContain('Configuration saved')
  })

  it('rejects saving with no security tools selected', async () => {
    getProjectById.mockResolvedValueOnce(project)

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0]?.setValue(false)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updateProject).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Select at least one security tool')
  })

  it('shows an error message when the project cannot be found', async () => {
    getProjectById.mockRejectedValueOnce(new Error('not found'))

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load this project')
  })
})
