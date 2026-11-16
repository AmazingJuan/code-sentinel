import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { ManagedUser } from '@/interfaces/UserInterface';
import { UserService } from '@/services/UserService';
import UsersView from '@/views/UsersView.vue';

const sampleUsers: ManagedUser[] = [
  {
    id: 'u1',
    name: 'Analyst User',
    email: 'analyst@code-sentinel.local',
    role: 'analyst',
    createdAt: '2026-08-01',
  },
  {
    id: 'u2',
    name: 'Admin User',
    email: 'admin@code-sentinel.local',
    role: 'admin',
    createdAt: '2026-08-01',
  },
];

vi.mock('@/services/UserService', () => ({
  UserService: {
    findAll: vi.fn<() => Promise<ManagedUser[]>>(),
    create: vi.fn<(payload: { name: string; email: string; password: string; role: ManagedUser['role'] }) => Promise<ManagedUser>>(),
    update: vi.fn<(id: string, payload: { name: string; email: string; role: ManagedUser['role'] }) => Promise<ManagedUser>>(),
    remove: vi.fn<(id: string) => Promise<void>>(),
  },
}));

describe('UsersView.vue', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra la lista de usuarios', async () => {
    vi.mocked(UserService.findAll).mockResolvedValueOnce(sampleUsers);

    const wrapper = mount(UsersView);
    await flushPromises();

    expect(UserService.findAll).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Analyst User');
    expect(wrapper.text()).toContain('admin@code-sentinel.local');
  });

  it('permite crear un usuario nuevo y recarga la lista', async () => {
    vi.mocked(UserService.findAll)
      .mockResolvedValueOnce(sampleUsers)
      .mockResolvedValueOnce([
        ...sampleUsers,
        {
          id: 'u3',
          name: 'New User',
          email: 'new@code-sentinel.local',
          role: 'analyst',
          createdAt: '2026-08-16',
        },
      ]);
    vi.mocked(UserService.create).mockResolvedValueOnce({
      id: 'u3',
      name: 'New User',
      email: 'new@code-sentinel.local',
      role: 'analyst',
      createdAt: '2026-08-16',
    });

    const wrapper = mount(UsersView);
    await flushPromises();

    const inputs = wrapper.findAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3);
    await inputs[0]!.setValue('New User');
    await inputs[1]!.setValue('new@code-sentinel.local');
    await inputs[2]!.setValue('Password123!');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(UserService.create).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@code-sentinel.local',
      password: 'Password123!',
      role: 'analyst',
    });
    expect(wrapper.text()).toContain('User created successfully.');
  });

  it('permite eliminar un usuario existente', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(UserService.findAll).mockResolvedValueOnce(sampleUsers).mockResolvedValueOnce([sampleUsers[1]!]);
    vi.mocked(UserService.remove).mockResolvedValueOnce(undefined);

    const wrapper = mount(UsersView);
    await flushPromises();

    const deleteButtons = wrapper.findAll('button').filter((buttonElement) => buttonElement.text().includes('Delete'));
    expect(deleteButtons.length).toBeGreaterThan(0);
    await deleteButtons[0]!.trigger('click');
    await flushPromises();

    expect(UserService.remove).toHaveBeenCalledWith('u1');
    expect(wrapper.text()).not.toContain('Analyst User');
    expect(wrapper.text()).toContain('Admin User');
  });
});
