import { clearSession } from '../auth/credentials.js';

export function handleLogoutCommand(): number {
  if (clearSession()) {
    console.log(' Session cleared successfully. You are now logged out.');
  } else {
    console.log(' No active session found to clear.');
  }
  return 0;
}
