import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'

import StatusBadge from '@/components/StatusBadge.vue'
import type { ScanStatus } from '@/interfaces/ScanInterface'

describe('StatusBadge (RF-006)', () => {
  it.each<[ScanStatus, string, string]>([
    ['pending', 'Pending', 'text-gray-300'],
    ['running', 'Running', 'text-blue-300'],
    ['completed', 'Completed', 'text-green-300'],
    ['failed', 'Failed', 'text-red-300'],
  ])('renders the %s state with its label and color', (status, label, colorClass) => {
    const wrapper = mount(StatusBadge, { props: { status } })

    expect(wrapper.text()).toBe(label)
    expect(wrapper.classes()).toContain(colorClass)
  })

  it('animates the dot only while the scan is running', () => {
    const running = mount(StatusBadge, { props: { status: 'running' } })
    const completed = mount(StatusBadge, { props: { status: 'completed' } })

    expect(running.find('span > span').classes()).toContain('animate-pulse')
    expect(completed.find('span > span').classes()).not.toContain('animate-pulse')
  })
})

