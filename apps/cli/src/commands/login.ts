import { getCredentialsFilePath, type StoredSession } from '../auth/credentials.js';
import { openBrowser, startLoginServer } from '../auth/login-server.js';
import { printBanner, printRule } from '../cli/output.js';
import { errorMessage } from '../domain/errors.js';

/** Opens the local login page in the browser and waits for the user to sign in. */
export async function authenticateInBrowser(apiUrl: string): Promise<StoredSession> {
  const { port, sessionPromise } = await startLoginServer(apiUrl);
  const loginUrl = `http://127.0.0.1:${port}`;
  console.log(` Opening authentication portal: ${loginUrl}`);
  console.log(' (If your browser does not open automatically, please open the link above)');
  openBrowser(loginUrl);
  console.log(' Waiting for authorization in browser...');
  return sessionPromise;
}

export async function handleLoginCommand(apiUrl: string): Promise<number> {
  printBanner('Web Authentication');
  console.log(' Starting local authentication server...');

  try {
    const session = await authenticateInBrowser(apiUrl);
    printRule();
    console.log(' Authentication successful!');
    console.log(` User   : ${session.user?.name || session.user?.email || 'Authenticated User'}`);
    console.log(` Email  : ${session.user?.email || 'N/A'}`);
    if (session.user?.role) {
      console.log(` Role   : ${session.user.role}`);
    }
    console.log(` Saved session to ${getCredentialsFilePath()}`);
    console.log(' You can now run "code-sentinel scan" without passing --token.');
    return 0;
  } catch (error: unknown) {
    console.error(` Authentication failed: ${errorMessage(error)}`);
    return 1;
  }
}
