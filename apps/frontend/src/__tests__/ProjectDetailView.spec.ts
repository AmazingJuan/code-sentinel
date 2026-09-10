import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { AuthUser } from '@/interfaces/AuthInterface'
import type { ProjectAssignment } from '@/interfaces/ProjectAssignmentInterface'
import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import type { ManagedUser } from '@/interfaces/UserInterface'
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

const analystUser: AuthUser = { id: 'user-1', email: 'analyst@example.com', name: 'Analyst', role: 'analyst' }
const adminUser: AuthUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' }

const getProjectById = vi.fn<(id: string) => Promise<ProjectInterface>>()
const updateProject = vi.fn<(id: string, payload: UpdateProjectDto) => Promise<ProjectInterface>>()
const getAssignments = vi.fn<(projectId: string) => Promise<ProjectAssignment[]>>()
const assignUserToProject = vi.fn<(projectId: string, userId: string) => Promise<ProjectAssignment>>()
const unassignUserFromProject = vi.fn<(projectId: string, userId: string) => Promise<void>>()
const findAllUsers = vi.fn<() => Promise<ManagedUser[]>>()
const getUser = vi.fn<() => AuthUser | null>()

vi.mock('@/services/ProjectService', () => ({
  ProjectService: {
    getProjectById: (id: string) => getProjectById(id),
    updateProject: (id: string, payload: UpdateProjectDto) => updateProject(id, payload),
    getAssignments: (projectId: string) => getAssignments(projectId),
    assignUser: (projectId: string, userId: string) => assignUserToProject(projectId, userId),
    unassignUser: (projectId: string, userId: string) => unassignUserFromProject(projectId, userId),
  },
}))

vi.mock('@/services/UserService', () => ({
  UserService: {
    findAll: () => findAllUsers(),
  },
}))

vi.mock('@/services/AuthService', () => ({
  AuthService: {
    getUser: () => getUser(),
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
    getUser.mockReturnValue(analystUser)
    getProjectById.mockResolvedValueOnce(project)

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    expect(getProjectById).toHaveBeenCalledWith('project-1')
    expect(wrapper.text()).toContain('payments-service')
    expect((wrapper.find('#project-repo').element as HTMLInputElement).value).toBe(project.repo)
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('saves the updated configuration', async () => {
    getUser.mockReturnValue(analystUser)
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
    getUser.mockReturnValue(analystUser)
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
    getUser.mockReturnValue(analystUser)
    getProjectById.mockRejectedValueOnce(new Error('not found'))

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load this project')
  })

  it('does not show the assignments panel to a non-administrator', async () => {
    getUser.mockReturnValue(analystUser)
    getProjectById.mockResolvedValueOnce(project)

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    expect(getAssignments).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Project access')
  })

  it('loads and displays assignments for an administrator', async () => {
    getUser.mockReturnValue(adminUser)
    getProjectById.mockResolvedValueOnce(project)
    getAssignments.mockResolvedValueOnce([
      {
        id: 'assignment-1',
        projectId: 'project-1',
        userId: 'user-1',
        assignedAt: '2026-09-01T00:00:00.000Z',
        user: { id: 'user-1', email: 'analyst@example.com', name: 'Analyst', role: 'analyst', createdAt: '2026-01-01T00:00:00.000Z' },
      },
    ])
    findAllUsers.mockResolvedValueOnce([
      { id: 'user-1', email: 'analyst@example.com', name: 'Analyst', role: 'analyst', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'user-2', email: 'other@example.com', name: 'Other Analyst', role: 'analyst', createdAt: '2026-01-01T00:00:00.000Z' },
    ])

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    expect(getAssignments).toHaveBeenCalledWith('project-1')
    expect(wrapper.text()).toContain('Project access')
    expect(wrapper.text()).toContain('Analyst')
    expect(wrapper.find('select').findAll('option')).toHaveLength(2) // placeholder + the unassigned user
  })

  it('assigns a selected user to the project', async () => {
    getUser.mockReturnValue(adminUser)
    getProjectById.mockResolvedValueOnce(project)
    getAssignments.mockResolvedValueOnce([])
    findAllUsers.mockResolvedValueOnce([
      { id: 'user-2', email: 'other@example.com', name: 'Other Analyst', role: 'analyst', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    assignUserToProject.mockResolvedValueOnce({
      id: 'assignment-2',
      projectId: 'project-1',
      userId: 'user-2',
      assignedAt: '2026-09-05T00:00:00.000Z',
      user: { id: 'user-2', email: 'other@example.com', name: 'Other Analyst', role: 'analyst', createdAt: '2026-01-01T00:00:00.000Z' },
    })

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    await wrapper.find('select').setValue('user-2')
    await wrapper.findAll('form')[1]?.trigger('submit.prevent')
    await flushPromises()

    expect(assignUserToProject).toHaveBeenCalledWith('project-1', 'user-2')
    expect(wrapper.text()).toContain('Other Analyst')
  })

  it('removes an existing assignment', async () => {
    getUser.mockReturnValue(adminUser)
    getProjectById.mockResolvedValueOnce(project)
    getAssignments.mockResolvedValueOnce([
      {
        id: 'assignment-1',
        projectId: 'project-1',
        userId: 'user-1',
        assignedAt: '2026-09-01T00:00:00.000Z',
        user: { id: 'user-1', email: 'analyst@example.com', name: 'Analyst', role: 'analyst', createdAt: '2026-01-01T00:00:00.000Z' },
      },
    ])
    findAllUsers.mockResolvedValueOnce([
      { id: 'user-1', email: 'analyst@example.com', name: 'Analyst', role: 'analyst', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    unassignUserFromProject.mockResolvedValueOnce(undefined)

    const wrapper = await mountProjectDetailView()
    await flushPromises()

    await wrapper.find('button[type="button"]').trigger('click')
    await flushPromises()

    expect(unassignUserFromProject).toHaveBeenCalledWith('project-1', 'user-1')
    expect(wrapper.text()).toContain('No users are assigned to this project yet.')
  })
})
