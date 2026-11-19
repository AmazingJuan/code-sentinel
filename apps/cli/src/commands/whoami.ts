import { getStoredSession, validateTokenWithBackend } from '../auth/credentials.js';
import { printBanner } from '../cli/output.js';

export async function handleWhoamiCommand(apiUrl: string): Promise<number> {
  const session = getStoredSession();
  if (!session) {
    console.log(' Not logged in. Run "code-sentinel login" to authenticate.');
    return 1;
  }
  const check = await validateTokenWithBackend(apiUrl, session.token);
  printBanner('Current Session');
  const status = !check.valid
    ? 'Expired or Invalid'
    : check.unreachable
      ? 'Active (backend unreachable)'
      : 'Active (verified)';
  console.log(` Status   : ${status}`);
  console.log(` User     : ${check.user?.name || session.user?.name || 'N/A'}`);
  console.log(` Email    : ${check.user?.email || session.user?.email || 'N/A'}`);
  console.log(` Role     : ${check.user?.role || session.user?.role || 'N/A'}`);
  console.log(` API URL  : ${apiUrl}`);
  console.log(` Saved At : ${session.savedAt}`);
  return check.valid ? 0 : 1;
}
