// apps/frontend/src/services/ReportService.ts
import { httpClient } from '@/services/httpClient'

export class ReportService {
  /**
   * RF-033 / RF-034: Request download of a protected security report for a scan.
   */
  static async downloadProtectedReport(
    scanId: string,
    password: string,
    format: 'html' | 'json' = 'html',
  ): Promise<void> {
    const response = await httpClient.post(
      `/scans/${scanId}/report/download`,
      { password, format },
      { responseType: 'blob' },
    )

    const blob = new Blob([response.data], {
      type: format === 'json' ? 'application/json' : 'text/html',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `code-sentinel-report-scan-${scanId}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}
