import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

import type { AuthUser } from '@/interfaces/AuthInterface';
import { AuthService } from '@/services/AuthService';
import LoginView from '@/views/LoginView.vue';

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/overview', name: 'overview', component: { template: '<div>Overview</div>' } },
  ],
});

vi.mock('@/services/AuthService', () => ({
  AuthService: {
    login: vi.fn<(email: string, password: string) => Promise<AuthUser>>(),
    getErrorMessage: vi.fn<(error: unknown) => string>(),
    getHomeRouteName: vi.fn<() => 'users' | 'overview'>().mockReturnValue('overview'),
  },
}));

describe('LoginView.vue', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza campos de email y password', async () => {
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginView, {
      global: { plugins: [router] },
    });

    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
  });

  it('procesa login exitoso y navega a la ruta principal', async () => {
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginView, {
      global: { plugins: [router] },
    });

    vi.mocked(AuthService.login).mockResolvedValueOnce({
      id: 'u1',
      email: 'test@codesentinel.local',
      name: 'Test',
      role: 'analyst',
      createdAt: '2026-08-01',
    });

    await wrapper.find('input[type="email"]').setValue('test@codesentinel.local');
    await wrapper.find('input[type="password"]').setValue('ValidPassword1!');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(AuthService.login).toHaveBeenCalledWith('test@codesentinel.local', 'ValidPassword1!');
    expect(router.currentRoute.value.name).toBe('overview');
  });

  it('muestra mensaje de error si el login falla', async () => {
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginView, {
      global: { plugins: [router] },
    });

    vi.mocked(AuthService.login).mockRejectedValueOnce(new Error('Invalid email or password'));
    vi.mocked(AuthService.getErrorMessage).mockReturnValueOnce('Invalid email or password');

    await wrapper.find('input[type="email"]').setValue('wrong@codesentinel.local');
    await wrapper.find('input[type="password"]').setValue('wrong');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('Invalid email or password');
  });
});
