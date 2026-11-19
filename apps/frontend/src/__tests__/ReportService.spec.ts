import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/services/httpClient'
import { ReportService } from '@/services/ReportService'

vi.mock('@/services/httpClient', () => ({
  httpClient: {
    post: vi.fn<(...args: unknown[]) => Promise<{ data: unknown }>>(),
  },
}))

describe('ReportService', () => {
  beforeEach(() => {
    window.URL.createObjectURL = vi.fn<(...args: unknown[]) => string>().mockReturnValue('blob:http://localhost/mock-uuid')
    window.URL.revokeObjectURL = vi.fn<(...args: unknown[]) => void>()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls POST /scans/:id/report/download and initiates download', async () => {
    const mockBlobData = '<html>Mock Report</html>'
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      data: mockBlobData,
    })

    await ReportService.downloadProtectedReport('scan-123', 'secret123', 'html')

    expect(httpClient.post).toHaveBeenCalledWith(
      '/scans/scan-123/report/download',
      { password: 'secret123', format: 'html' },
      { responseType: 'blob' },
    )
    expect(window.URL.createObjectURL).toHaveBeenCalled()
    expect(window.URL.revokeObjectURL).toHaveBeenCalled()
  })
})
