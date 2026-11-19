import {
  createCipheriv,
  createDecipheriv,
  pbkdf2,
  randomBytes,
} from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

// These parameters are mirrored by the WebCrypto code embedded in the HTML
// report; changing them breaks decryption of reports already issued.
export const REPORT_PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;
const GCM_IV_LENGTH_BYTES = 12;
const CIPHER = 'aes-256-gcm';

export interface EncryptedReportBundle {
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return pbkdf2Async(
    password,
    salt,
    REPORT_PBKDF2_ITERATIONS,
    KEY_LENGTH_BYTES,
    'sha256',
  );
}

export async function encryptReportPayload(
  data: unknown,
  password: string,
): Promise<EncryptedReportBundle> {
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const iv = randomBytes(GCM_IV_LENGTH_BYTES);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv(CIPHER, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);

  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

/** Throws if the password is wrong or the bundle was tampered with. */
export async function decryptReportPayload(
  bundle: EncryptedReportBundle,
  password: string,
): Promise<string> {
  const key = await deriveKey(password, Buffer.from(bundle.salt, 'hex'));
  const decipher = createDecipheriv(CIPHER, key, Buffer.from(bundle.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(bundle.authTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(bundle.ciphertext, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
