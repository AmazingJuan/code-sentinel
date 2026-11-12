// apps/frontend/src/__tests__/ScanAndFindingServices.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FindingService } from '@/services/FindingService'
import { httpClient } from '@/services/httpClient'
import { ScanService } from '@/services/ScanService'

vi.mock('@/services/httpClient', () => ({
  httpClient: {
    get: vi.fn<(...args: unknown[]) => Promise<{ data: unknown }>>(),
  },
}))

describe('ScanService & FindingService', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('ScanService calls GET /scans and GET /scans/:id', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({ data: [{ id: 's1' }] })
    const scans = await ScanService.getScans({ status: 'completed' })
    expect(scans).toEqual([{ id: 's1' }])
    expect(httpClient.get).toHaveBeenCalledWith('/scans', {
      params: { status: 'completed' },
    })

    vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { id: 's1' } })
    const scan = await ScanService.getScanById('s1')
    expect(scan).toEqual({ id: 's1' })
    expect(httpClient.get).toHaveBeenCalledWith('/scans/s1')
  })

  it('FindingService calls GET /findings and GET /findings/:id', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({ data: [{ id: 'f1' }] })
    const findings = await FindingService.getFindings({ severity: 'critical' })
    expect(findings).toEqual([{ id: 'f1' }])
    expect(httpClient.get).toHaveBeenCalledWith('/findings', {
      params: { severity: 'critical' },
    })

    vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { id: 'f1' } })
    const finding = await FindingService.getFindingById('f1')
    expect(finding).toEqual({ id: 'f1' })
    expect(httpClient.get).toHaveBeenCalledWith('/findings/f1')
  })
})
