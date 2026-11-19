import { errorMessage } from '../domain/errors.js';
import type { NormalizedFinding } from '../domain/finding.js';
import { DEFAULT_TIMEOUT_MS, fetchWithTimeout, readErrorDetail } from './http.js';

export interface ScanSubmission {
  apiUrl: string;
  token: string;
  projectId: string;
  /** Tool categories (`SAST`, `Secret Scanner`), never tool names. */
  tools: string[];
  findings: NormalizedFinding[];
  commitSha?: string | null;
  branch?: string | null;
  /** When set, the scan is closed as `failed` with this message and no findings. */
  failureMessage?: string;
  timeoutMs?: number;
}

export interface ScanSubmissionResult {
  scanId: string;
  totalCount: number;
}

/**
 * Runs the ingestion flow from docs/contracts/scan-contract.md:
 * create (pending) -> running -> results (completed | failed).
 */
export async function submitScanToBackend(
  submission: ScanSubmission,
): Promise<ScanSubmissionResult> {
  const { apiUrl, token, projectId, tools, findings, failureMessage } = submission;
  const timeoutMs = submission.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const send = (path: string, method: string, body: unknown): Promise<Response> =>
    fetchWithTimeout(
      `${apiUrl}${path}`,
      { method, headers, body: JSON.stringify(body) },
      timeoutMs,
    );

  const createRes = await send('/scans', 'POST', {
    projectId,
    tools,
    commitSha: submission.commitSha ?? undefined,
    branch: submission.branch ?? undefined,
  });
  if (!createRes.ok) {
    throw new Error(
      `Failed to create scan (HTTP ${createRes.status}): ${await readErrorDetail(createRes)}`,
    );
  }
  const scan = (await createRes.json()) as { id?: unknown };
  if (typeof scan.id !== 'string' || scan.id.length === 0) {
    throw new Error('Failed to create scan: the backend response did not include a scan id');
  }
  const scanPath = `/scans/${encodeURIComponent(scan.id)}`;

  // Without this the scan would stay pending/running forever after a partial sync.
  const markFailed = async (reason: string): Promise<void> => {
    try {
      await send(`${scanPath}/status`, 'PATCH', { status: 'failed', errorMessage: reason });
    } catch {
      // Best effort: the original error is the one reported to the user.
    }
  };

  try {
    const statusRes = await send(`${scanPath}/status`, 'PATCH', { status: 'running' });
    if (!statusRes.ok) {
      throw new Error(
        `Failed to update scan status (HTTP ${statusRes.status}): ${await readErrorDetail(statusRes)}`,
      );
    }

    const resultsRes = await send(
      `${scanPath}/results`,
      'POST',
      failureMessage
        ? {
            status: 'failed',
            errorMessage: failureMessage,
            commitSha: submission.commitSha ?? undefined,
            branch: submission.branch ?? undefined,
            findings: [],
          }
        : {
            status: 'completed',
            commitSha: submission.commitSha ?? undefined,
            branch: submission.branch ?? undefined,
            findings,
          },
    );
    if (!resultsRes.ok) {
      throw new Error(
        `Failed to submit scan findings (HTTP ${resultsRes.status}): ${await readErrorDetail(resultsRes)}`,
      );
    }

    const resultData = (await resultsRes.json().catch((): unknown => ({}))) as {
      totalCount?: unknown;
    };
    return {
      scanId: scan.id,
      totalCount:
        typeof resultData.totalCount === 'number'
          ? resultData.totalCount
          : failureMessage
            ? 0
            : findings.length,
    };
  } catch (error: unknown) {
    await markFailed(
      `CLI could not complete the scan upload: ${errorMessage(error)}`.slice(0, 500),
    );
    throw error;
  }
}
