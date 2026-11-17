import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import CodeViewer from '@/components/CodeViewer.vue'

describe('CodeViewer', () => {
  it('renders code snippet with highlighted line', () => {
    const codeSnippet = `const a = 1\nconst b = 2\nconst c = 3`
    const wrapper = mount(CodeViewer, {
      props: {
        codeSnippet,
        targetLine: 2,
        filePath: 'src/index.js',
      },
    })

    expect(wrapper.text()).toContain('src/index.js')
    expect(wrapper.text()).toContain('const a = 1')
    expect(wrapper.text()).toContain('const b = 2')
    expect(wrapper.text()).toContain('const c = 3')

    const highlighted = wrapper.find('.border-destructive')
    expect(highlighted.exists()).toBe(true)
    expect(highlighted.text()).toContain('const a = 1')
  })

  it('renders JSON array code snippet with target line highlighted', () => {
    const snippetRows = JSON.stringify([
      { line: 10, text: 'import fs from "fs"', highlight: false },
      { line: 11, text: 'const data = eval(input)', highlight: true },
    ])
    const wrapper = mount(CodeViewer, {
      props: {
        codeSnippet: snippetRows,
        targetLine: 11,
        filePath: 'src/eval.ts',
      },
    })

    expect(wrapper.text()).toContain('src/eval.ts')
    expect(wrapper.text()).toContain('const data = eval(input)')
    const highlighted = wrapper.find('.border-destructive')
    expect(highlighted.exists()).toBe(true)
    expect(highlighted.text()).toContain('eval(input)')
  })

  it('renders empty fallback when code snippet is not provided', () => {
    const wrapper = mount(CodeViewer, {
      props: {
        codeSnippet: null,
        filePath: 'src/config.ts',
      },
    })

    expect(wrapper.text()).toContain('Source code snippet not available for this finding.')
  })
})
