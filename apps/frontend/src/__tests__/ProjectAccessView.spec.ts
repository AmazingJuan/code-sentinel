import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'

import ProjectAssignmentsPanel from '@/components/ProjectAssignmentsPanel.vue'
import type { ProjectAssignment } from '@/interfaces/ProjectAssignmentInterface'
import type { ProjectDirectoryEntryInterface } from '@/interfaces/ProjectDirectoryEntryInterface'
import type { ManagedUser } from '@/interfaces/UserInterface'
import ProjectAccessView from '@/views/ProjectAccessView.vue'

const directory: ProjectDirectoryEntryInterface[] = [{ id: 'project-1', name: 'payments-service' }]

const analyst: ManagedUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'analyst',
  createdAt: '2026-01-01T00:00:00.000Z',
}
const otherAnalyst: ManagedUser = {
  id: 'user-2',
  email: 'other@example.com',
  name: 'Other Analyst',
  role: 'analyst',
  createdAt: '2026-01-01T00:00:00.000Z',
}
const admin: ManagedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const existingAssignment: ProjectAssignment = {
  id: 'assignment-1',
  projectId: 'project-1',
  userId: 'user-1',
  assignedAt: '2026-09-01T00:00:00.000Z',
  user: analyst,
}

const getDirectory = vi.fn<() => Promise<ProjectDirectoryEntryInterface[]>>()
const getAssignments = vi.fn<(projectId: string) => Promise<ProjectAssignment[]>>()
const assignUserToProject =
  vi.fn<(projectId: string, userId: string) => Promise<ProjectAssignment>>()
const unassignUserFromProject = vi.fn<(projectId: string, userId: string) => Promise<void>>()
const findAllUsers = vi.fn<() => Promise<ManagedUser[]>>()

vi.mock('@/services/ProjectService', () => ({
  ProjectService: {
    getDirectory: () => getDirectory(),
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

async function mountAndSelectProject(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(ProjectAccessView)
  await flushPromises()
  await wrapper.find('#project-select').setValue('project-1')
  await flushPromises()
  return wrapper
}

describe('ProjectAccessView', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('lists projects by name only, from the admin directory (RF-032)', async () => {
    getDirectory.mockResolvedValueOnce(directory)
    findAllUsers.mockResolvedValueOnce([analyst])

    const wrapper = mount(ProjectAccessView)
    await flushPromises()

    expect(getDirectory).toHaveBeenCalled()
    expect(wrapper.text()).toContain('payments-service')
    // The assignments panel only appears once a project is chosen.
    expect(wrapper.findComponent(ProjectAssignmentsPanel).exists()).toBe(false)
    expect(getAssignments).not.toHaveBeenCalled()
  })

  it('loads the assignments of the selected project and offers only unassigned analysts', async () => {
    getDirectory.mockResolvedValueOnce(directory)
    findAllUsers.mockResolvedValueOnce([analyst, otherAnalyst, admin])
    getAssignments.mockResolvedValueOnce([existingAssignment])

    const wrapper = await mountAndSelectProject()

    expect(getAssignments).toHaveBeenCalledWith('project-1')
    expect(wrapper.text()).toContain('Analyst')
    const userOptions = wrapper.findAll('select')[1]?.findAll('option') ?? []
    // placeholder + Other Analyst; the assigned analyst and the admin are excluded
    expect(userOptions).toHaveLength(2)
    expect(userOptions[1]?.text()).toContain('Other Analyst')
  })

  it('assigns a selected analyst to the project', async () => {
    getDirectory.mockResolvedValueOnce(directory)
    findAllUsers.mockResolvedValueOnce([otherAnalyst])
    getAssignments.mockResolvedValueOnce([])
    assignUserToProject.mockResolvedValueOnce({
      id: 'assignment-2',
      projectId: 'project-1',
      userId: 'user-2',
      assignedAt: '2026-09-05T00:00:00.000Z',
      user: otherAnalyst,
    })

    const wrapper = await mountAndSelectProject()

    await wrapper.findAll('select')[1]?.setValue('user-2')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(assignUserToProject).toHaveBeenCalledWith('project-1', 'user-2')
    expect(wrapper.text()).toContain('Other Analyst')
  })

  it('removes an existing assignment', async () => {
    getDirectory.mockResolvedValueOnce(directory)
    findAllUsers.mockResolvedValueOnce([analyst])
    getAssignments.mockResolvedValueOnce([existingAssignment])
    unassignUserFromProject.mockResolvedValueOnce(undefined)

    const wrapper = await mountAndSelectProject()

    await wrapper.find('button[type="button"]').trigger('click')
    await flushPromises()

    expect(unassignUserFromProject).toHaveBeenCalledWith('project-1', 'user-1')
    expect(wrapper.text()).toContain('No users are assigned to this project yet.')
  })

  it('shows a friendly error when the directory cannot be loaded', async () => {
    getDirectory.mockRejectedValueOnce(new Error('network'))
    findAllUsers.mockResolvedValueOnce([])

    const wrapper = mount(ProjectAccessView)
    await flushPromises()

    expect(wrapper.text()).toContain('We could not load the projects.')
  })
})